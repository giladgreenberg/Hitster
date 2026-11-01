import { useCallback, useEffect, useRef, useState } from 'react'
import { activateBrowserPlayer, armActivationOnNextClick, browserActivated, getBrowserDeviceId, lastSdkProblem } from './sdk'
import { currentlyPlaying, describePlayerState, isMobileBrowser, pause as apiPause, playTrack, randomStartMs, resume as apiResume } from './controller'
import type { Song } from '../songs/types'

export type OutputMode = { kind: 'browser' } | { kind: 'device'; id: string; name: string }

const KEY = 'hitster.output.v1'

function loadMode(): OutputMode | null {
  try {
    const m = JSON.parse(localStorage.getItem(KEY) ?? 'null') as OutputMode | null
    if (m?.kind === 'browser' && isMobileBrowser()) return null
    return m
  } catch {
    return null
  }
}

export function usePlayback() {
  const [mode, setModeState] = useState<OutputMode | null>(() => loadMode() ?? (isMobileBrowser() ? null : { kind: 'browser' }))
  const [isPlaying, setPlaying] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const current = useRef<{ uri: string; startMs: number; device: string; albumUri: string | null } | null>(null)
  const [browserReady, setBrowserReady] = useState(false)
  const [audioUnlocked, setAudioUnlocked] = useState(browserActivated)
  const [status, setStatus] = useState<string | null>(null)

  // ---------- "השמעת קטע בלבד": כל השמעה היא קטע קבוע (למשל 20 שניות) מאותה נקודת התחלה ----------
  const [clipMs, setClipMs] = useState(0)
  const clip = useRef<{ remaining: number; startedAt: number | null; timer: ReturnType<typeof setTimeout> | null }>({ remaining: 0, startedAt: null, timer: null })
  /** למסך: מתי הקטע ייגמר (אם מתנגן), וכמה נשאר (אם מושהה) */
  const [clipView, setClipView] = useState<{ endsAt: number | null; remaining: number } | null>(null)

  const clipClear = () => {
    if (clip.current.timer) clearTimeout(clip.current.timer)
    clip.current.timer = null
  }

  /** מתחיל לספור את הקטע. fromStart = השמעה חדשה / נגן שוב (קטע מלא), אחרת – המשך מהיכן שעצרנו */
  const clipRun = (dev: string, fromStart: boolean) => {
    if (!clipMs) return
    clipClear()
    const remaining = fromStart ? clipMs : clip.current.remaining
    const now = Date.now()
    clip.current = {
      remaining,
      startedAt: now,
      timer: setTimeout(() => {
        clip.current = { remaining: 0, startedAt: null, timer: null }
        setClipView({ endsAt: null, remaining: 0 })
        setPlaying(false)
        apiPause(dev).catch(() => {})
      }, remaining),
    }
    setClipView({ endsAt: now + remaining, remaining })
  }

  const clipPause = () => {
    if (!clipMs || clip.current.startedAt === null) return
    clipClear()
    const remaining = Math.max(0, clip.current.remaining - (Date.now() - clip.current.startedAt))
    clip.current = { remaining, startedAt: null, timer: null }
    setClipView({ endsAt: null, remaining })
  }

  const clipReset = () => {
    clipClear()
    clip.current = { remaining: 0, startedAt: null, timer: null }
    setClipView(null)
  }

  /** קובע את אורך הקטע בשניות (0 = בלי הגבלה) */
  const setClipSeconds = useCallback((sec: number) => setClipMs(Math.max(0, sec) * 1000), [])

  const checkStatus = () => {
    setStatus(null)
    setTimeout(() => {
      describePlayerState()
        .then(setStatus)
        .catch(() => {})
    }, 2000)
  }

  // טוענים את הנגן בדפדפן מראש, כדי שהלחיצה על "נגן" תוכל "לשחרר" את חסימת הקול של הדפדפן
  useEffect(() => {
    if (mode?.kind !== 'browser') return
    let cancelled = false
    let disarm = () => {}
    getBrowserDeviceId()
      .then(() => {
        if (cancelled) return
        setBrowserReady(true)
        // הלחיצה הבאה בדף משחררת את חסימת הקול – כדי שגם טלפון יוכל לנגן דרך המחשב
        disarm = armActivationOnNextClick(() => setAudioUnlocked(true))
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      cancelled = true
      disarm()
    }
  }, [mode])

  const setMode = useCallback((m: OutputMode | null) => {
    setModeState(m)
    if (m) localStorage.setItem(KEY, JSON.stringify(m))
    else localStorage.removeItem(KEY)
  }, [])

  const deviceId = useCallback(async () => {
    if (!mode) throw new Error('בחרו קודם על מה לנגן')
    if (mode.kind === 'browser') {
      activateBrowserPlayer()
      return getBrowserDeviceId()
    }
    return mode.id
  }, [mode])

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    if (mode?.kind === 'browser') activateBrowserPlayer() // חייב לקרות מיד בלחיצה
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      await fn()
      return true
    } catch (e) {
      const sdk = mode?.kind === 'browser' && lastSdkProblem ? ` · ${lastSdkProblem}` : ''
      const remotePc =
        mode?.kind === 'device' && mode.name.startsWith('היטסטר')
          ? '\n\n💡 מנגנים דרך המחשב? ודאו שהמשחק פתוח שם בדפדפן, ש"נגן כאן בדפדפן" מסומן, ושלחצתם פעם אחת בדף שם (הדפדפן חוסם קול עד לחיצה). אחר כך נסו שוב.'
          : ''
      setError((e instanceof Error ? e.message : String(e)) + sdk + remotePc)
      return false
    } finally {
      setBusy(false)
    }
  }, [mode])

  /** מנגן שיר חדש. randomStart = להתחיל מנקודה אקראית */
  const playSong = useCallback(
    (song: Song, randomStart: boolean) =>
      run(async () => {
        const startMs = randomStart ? randomStartMs(song.durationMs) : 0
        const dev = await deviceId()
        current.current = { uri: song.uri, startMs, device: dev, albumUri: song.albumUri }
        await playTrack(dev, song.uri, startMs, song.albumUri)
        setPlaying(true)
        clipRun(dev, true)
        checkStatus()
      }),
    [deviceId, run, clipMs],
  )

  /** נגן שוב מההתחלה (או מאותה נקודה אקראית שבה התחיל התור) */
  const restart = useCallback(
    () =>
      run(async () => {
        if (!current.current) return
        const dev = await deviceId()
        current.current.device = dev
        await playTrack(dev, current.current.uri, current.current.startMs, current.current.albumUri)
        setPlaying(true)
        clipRun(dev, true)
      }),
    [deviceId, run, clipMs],
  )

  const pause = useCallback(
    () =>
      run(async () => {
        clipPause()
        await apiPause(await deviceId())
        setPlaying(false)
      }),
    [deviceId, run, clipMs],
  )

  const resume = useCallback(
    () =>
      run(async () => {
        const dev = await deviceId()
        if (clipMs && clip.current.remaining <= 0 && current.current) {
          // הקטע נגמר – "המשך" = מתחילים את הקטע מחדש
          await playTrack(dev, current.current.uri, current.current.startMs, current.current.albumUri)
          setPlaying(true)
          clipRun(dev, true)
          return
        }
        if (current.current && current.current.device !== dev) {
          // החליפו מכשיר באמצע – מתחילים את השיר במכשיר החדש
          current.current.device = dev
          await playTrack(dev, current.current.uri, current.current.startMs, current.current.albumUri)
        } else {
          await apiResume(dev)
        }
        setPlaying(true)
        clipRun(dev, false)
      }),
    [deviceId, run, clipMs],
  )

  /** עוצר בשקט (למשל במעבר לחשיפה) בלי להציג שגיאה */
  const stop = useCallback(async () => {
    clipPause()
    setPlaying(false)
    try {
      if (mode) await apiPause(await deviceId())
    } catch {
      /* ignore */
    }
  }, [deviceId, mode])

  // שומר: אם התחיל להתנגן שיר אחר (למשל השיר הבא באלבום) – עוצרים
  useEffect(() => {
    if (!isPlaying) return
    const t = setInterval(async () => {
      const cur = current.current
      if (!cur) return
      try {
        const st = await currentlyPlaying()
        if (st.playing && st.uri && st.uri !== cur.uri) {
          await apiPause(cur.device)
          setPlaying(false)
        } else if (!st.playing) setPlaying(false)
      } catch {
        /* ignore */
      }
    }, 4000)
    return () => clearInterval(t)
  }, [isPlaying])

  /** לקרוא בתוך לחיצה, לפני פעולה ארוכה שבסופה ננגן (משחרר חסימת קול בדפדפן) */
  const prime = useCallback(() => {
    if (mode?.kind === 'browser') activateBrowserPlayer()
  }, [mode])

  /** שיר חדש בתור: עוצרים את הקודם ושוכחים אותו */
  const reset = useCallback(() => {
    if (current.current) stop()
    current.current = null
    clipReset()
    setPlaying(false)
  }, [stop])

  return { mode, setMode, reset, prime, browserReady, audioUnlocked: audioUnlocked || browserActivated, status, clipMs, clipView, setClipSeconds, isPlaying, busy, error, playSong, restart, pause, resume, stop, hasSong: () => current.current !== null }
}

export type Playback = ReturnType<typeof usePlayback>
