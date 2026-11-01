// טעינת Spotify Web Playback SDK – הופך את הדפדפן במחשב ל"נגן" (מכשיר Spotify Connect).
// לא נתמך בדפדפני מובייל.
import { getAccessToken } from '../spotify/auth'

interface SdkPlayer {
  connect(): Promise<boolean>
  disconnect(): void
  activateElement(): Promise<void>
  addListener(event: string, cb: (arg: any) => void): void
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void
    Spotify?: { Player: new (opts: { name: string; getOAuthToken: (cb: (t: string) => void) => void; volume?: number }) => SdkPlayer }
  }
}

let loading: Promise<void> | null = null

function loadScript(): Promise<void> {
  loading ??= new Promise((resolve, reject) => {
    if (window.Spotify) return resolve()
    window.onSpotifyWebPlaybackSDKReady = () => resolve()
    const s = document.createElement('script')
    s.src = 'https://sdk.scdn.co/spotify-player.js'
    s.async = true
    s.onerror = () => reject(new Error('טעינת נגן ספוטיפיי נכשלה'))
    document.body.appendChild(s)
  })
  return loading
}

let player: SdkPlayer | null = null
export let lastSdkProblem: string | null = null
/** ה-device_id של הנגן בדפדפן הזה (null = לא נוצר כאן נגן) */
export let ownBrowserDeviceId: string | null = null
let deviceIdPromise: Promise<string> | null = null

/** מחזיר את ה-device_id של הנגן בדפדפן (יוצר אותו בפעם הראשונה). */
export function getBrowserDeviceId(): Promise<string> {
  deviceIdPromise ??= (async () => {
    await loadScript()
    player = new window.Spotify!.Player({
      name: 'היטסטר (דפדפן במחשב)',
      volume: 0.8,
      getOAuthToken: (cb) => {
        getAccessToken().then((t) => t && cb(t))
      },
    })
    const id = new Promise<string>((resolve, reject) => {
      player!.addListener('ready', ({ device_id }) => {
        ownBrowserDeviceId = device_id
        resolve(device_id)
      })
      player!.addListener('initialization_error', ({ message }) => reject(new Error(`הדפדפן לא תומך בנגן: ${message}`)))
      player!.addListener('authentication_error', ({ message }) => reject(new Error(`בעיית הרשאה בנגן: ${message}`)))
      player!.addListener('account_error', () => reject(new Error('הנגן בדפדפן דורש חשבון Spotify Premium')))
      setTimeout(() => reject(new Error('הנגן בדפדפן לא עלה תוך 15 שניות')), 15000)
    })
    player.addListener('playback_error', ({ message }) => (lastSdkProblem = `שגיאת השמעה בדפדפן: ${message}`))
    player.addListener('autoplay_failed', () => (lastSdkProblem = 'הדפדפן חסם השמעה אוטומטית – לחצו שוב על נגן'))
    player.addListener('not_ready', () => (lastSdkProblem = 'הנגן בדפדפן התנתק – רעננו את הדף'))
    const ok = await player.connect()
    if (!ok) throw new Error('החיבור לנגן בדפדפן נכשל')
    return id
  })().catch((e) => {
    deviceIdPromise = null
    throw e
  })
  return deviceIdPromise
}

/** חובה לקרוא בתוך לחיצה של המשתמש – אחרת דפדפנים חוסמים השמעה אוטומטית. */
export function activateBrowserPlayer() {
  if (player) browserActivated = true
  player?.activateElement().catch(() => {})
}

/** האם כבר "שחררנו" את חסימת הקול בדפדפן הזה (בלחיצה של המשתמש) */
export let browserActivated = false

/**
 * מאפשר לנגן בדפדפן הזה להשמיע קול גם כשהפקודה מגיעה ממכשיר אחר (למשל מהטלפון).
 * דפדפנים חוסמים קול עד שמשתמש לוחץ על הדף – אז בלחיצה הראשונה אחרי שהנגן מוכן, משחררים.
 */
export function armActivationOnNextClick(onActivated: () => void) {
  if (browserActivated) return () => {}
  const handler = () => {
    if (!player) return
    player.activateElement().catch(() => {})
    browserActivated = true
    document.removeEventListener('pointerdown', handler, true)
    onActivated()
  }
  document.addEventListener('pointerdown', handler, true)
  return () => document.removeEventListener('pointerdown', handler, true)
}
