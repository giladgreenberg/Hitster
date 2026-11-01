// שליטה בהשמעה דרך Web API. גם הנגן בדפדפן (SDK) וגם אפליקציית ספוטיפיי בטלפון
// הם "מכשירים" – ההבדל היחיד הוא ה-device_id.
import { spotifyFetch } from '../spotify/api'

export interface Device {
  id: string
  name: string
  type: string // Computer / Smartphone / Speaker ...
  is_active: boolean
  is_restricted: boolean
}

export async function getDevices(): Promise<Device[]> {
  const res = await spotifyFetch<{ devices: Device[] }>('/me/player/devices')
  return res.devices.filter((d) => d.id && !d.is_restricted)
}

async function transferTo(deviceId: string) {
  await spotifyFetch('/me/player', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_ids: [deviceId], play: false }),
  })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** מנגן שיר מסוים במכשיר, החל מ-positionMs */
export async function playTrack(deviceId: string, uri: string, positionMs = 0) {
  const doPlay = () =>
    spotifyFetch(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: [uri], position_ms: Math.max(0, Math.floor(positionMs)) }),
    })
  try {
    await doPlay()
  } catch (e) {
    // מכשיר "רדום" (למשל אפליקציה בטלפון שלא ניגנה לאחרונה) – מעירים אותו ומנסים שוב
    if (e instanceof Error && /404|Device not found|NO_ACTIVE_DEVICE/i.test(e.message)) {
      await transferTo(deviceId)
      await sleep(700)
      await doPlay()
    } else throw e
  }
  // שלא יתנגן שיר אחר אחריו בטעות
  spotifyFetch(`/me/player/repeat?state=off&device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT' }).catch(() => {})
}

export function pause(deviceId: string) {
  return spotifyFetch(`/me/player/pause?device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT' })
}

export function resume(deviceId: string) {
  return spotifyFetch(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT' })
}

/** נקודת התחלה אקראית: בין 15% ל-60% מאורך השיר (לא נופלים על הסוף) */
export function randomStartMs(durationMs: number): number {
  if (!durationMs || durationMs < 60_000) return 0
  return Math.floor(durationMs * (0.15 + Math.random() * 0.45))
}

export function isMobileBrowser(): boolean {
  const ua = navigator.userAgent
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua))
}

/** מה ספוטיפיי חושב שקורה עכשיו – לאבחון */
export async function describePlayerState(): Promise<string> {
  const st = await spotifyFetch<{ is_playing: boolean; device?: { name: string; volume_percent: number | null } } | undefined>('/me/player')
  if (!st) return 'ספוטיפיי מדווח: אין השמעה פעילה באף מכשיר'
  const vol = st.device?.volume_percent
  return `ספוטיפיי מדווח: ${st.is_playing ? 'מתנגן' : 'לא מתנגן'} במכשיר "${st.device?.name ?? '?'}"${vol != null ? ` · עוצמה ${vol}%` : ''}`
}
