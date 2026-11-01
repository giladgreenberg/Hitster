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

async function transferTo(deviceId: string, play = false) {
  await spotifyFetch('/me/player', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_ids: [deviceId], play }),
  })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface PlayerState {
  is_playing: boolean
  progress_ms: number | null
  device?: { id: string | null; name: string; is_active: boolean }
  item?: { uri: string } | null
}

function getState() {
  return spotifyFetch<PlayerState | undefined>('/me/player')
}

/** ממתין עד שספוטיפיי מדווח שהשיר באמת מתנגן במכשיר הנכון. מחזיר תיאור אם לא. */
async function verifyPlaying(deviceId: string, uri: string): Promise<string | null> {
  let last: PlayerState | undefined
  for (let i = 0; i < 6; i++) {
    await sleep(700)
    try {
      last = await getState()
    } catch {
      continue
    }
    if (last?.is_playing && last.device?.id === deviceId && last.item?.uri === uri) return null
  }
  if (!last) return 'ספוטיפיי מדווח שאין השמעה פעילה באף מכשיר'
  return `ספוטיפיי מדווח: ${last.is_playing ? 'מתנגן' : 'לא מתנגן'} במכשיר "${last.device?.name ?? '?'}"${
    last.item?.uri === uri ? '' : ' (שיר אחר)'
  }`
}

/** מנגן שיר מסוים במכשיר, החל מ-positionMs. זורק שגיאה מפורטת אם ההשמעה לא התחילה בפועל. */
export async function playTrack(deviceId: string, uri: string, positionMs = 0) {
  const doPlay = () =>
    spotifyFetch(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: [uri], position_ms: Math.max(0, Math.floor(positionMs)) }),
    })

  // אם המכשיר לא פעיל כרגע – קודם מעבירים אליו את ההשמעה ("מעירים" אותו)
  try {
    const st = await getState()
    if (st?.device?.id !== deviceId) {
      await transferTo(deviceId)
      await sleep(1000)
    }
  } catch {
    /* נמשיך בכל מקרה */
  }

  const pos = Math.max(0, Math.floor(positionMs))
  const attempts: [string, () => Promise<unknown>][] = [
    ['השמעה ישירה', doPlay],
    [
      'השמעה במכשיר הפעיל',
      async () => {
        await transferTo(deviceId).catch(() => {})
        await sleep(1200)
        // בלי device_id – הפקודה הולכת למכשיר הפעיל (עוזר באנדרואיד)
        await spotifyFetch('/me/player/play', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uris: [uri], position_ms: pos }),
        })
      },
    ],
    [
      'הוספה לתור ודילוג',
      async () => {
        await spotifyFetch(`/me/player/queue?uri=${encodeURIComponent(uri)}&device_id=${encodeURIComponent(deviceId)}`, { method: 'POST' })
        await sleep(500)
        await spotifyFetch(`/me/player/next?device_id=${encodeURIComponent(deviceId)}`, { method: 'POST' })
        await sleep(800)
        if (pos > 0) await spotifyFetch(`/me/player/seek?position_ms=${pos}&device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT' })
        await spotifyFetch(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT' }).catch(() => {})
      },
    ],
  ]

  const problems: string[] = []
  let ok = false
  for (const [label, attempt] of attempts) {
    try {
      await attempt()
      const problem = await verifyPlaying(deviceId, uri)
      if (!problem) {
        ok = true
        break
      }
      problems.push(`${label}: ${problem}`)
    } catch (e) {
      problems.push(`${label}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  if (!ok) throw new Error(`השיר לא התחיל להתנגן.\n${problems.join('\n')}`)

  // שלא יתנגן שיר אחר אחריו בטעות
  spotifyFetch(`/me/player/repeat?state=off&device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT' }).catch(() => {})
}

export async function pause(deviceId: string) {
  try {
    await spotifyFetch(`/me/player/pause?device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT' })
  } catch (e) {
    // 403 Restriction violated = כבר מושהה. זה בסדר.
    if (!(e instanceof Error && /403/.test(e.message))) throw e
  }
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
