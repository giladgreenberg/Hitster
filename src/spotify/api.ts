// קריאות ל-Spotify Web API.
// הערות לפי שינויי מצב Development (פברואר–מרץ 2026):
// - search מחזיר עד 10 תוצאות לבקשה.
// - אין GET /tracks (כמה שירים יחד) – שולפים כל שיר בנפרד עם GET /tracks/{id}.
// - תוכן פלייליסט: GET /playlists/{id}/items, וכל שורה מכילה item (בעבר track).
// - external_ids (ISRC) הוסר בפברואר אבל הוחזר במרץ 2026.

import { getAccessToken, logout } from './auth'

const BASE = 'https://api.spotify.com/v1'

export class SpotifyAuthError extends Error {}

export interface SpotifyTrack {
  id: string
  uri: string
  name: string
  type?: string
  is_local?: boolean
  is_playable?: boolean
  duration_ms: number
  artists: { name: string }[]
  album: {
    name: string
    uri?: string
    album_type?: string
    release_date: string
    images: { url: string; width: number | null }[]
  }
  external_ids?: { isrc?: string }
}

export interface SpotifyPlaylist {
  id: string
  name: string
  images: { url: string }[] | null
  owner: { id: string; display_name?: string }
  collaborative: boolean
  // ייתכן שהשדה נקרא items או tracks, תלוי בגרסה
  items?: { total: number }
  tracks?: { total: number }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ---------- הגנה ממגבלת הקצב של ספוטיפיי (429) ----------
// במצב Development המכסה נמוכה ומשותפת לכל המכשירים שמשתמשים באפליקציה.
// 1. מרווח מינימלי בין בקשות, כדי לא לשלוח "פרצים".
// 2. כשספוטיפיי מחזיר 429 – מכבדים את Retry-After במלואו, ובזמן הזה לא שולחים כלום
//    (בקשות נוספות בזמן חסימה רק מאריכות אותה).
const MIN_GAP_MS = 250
/** המתנות עד אורך כזה – מחכים בשקט וממשיכים. ארוכות יותר – מציגים שגיאה. */
const MAX_INLINE_WAIT_S = 60
const MAX_RATE_RETRIES = 8
let lastRequestAt = 0
let gate: Promise<unknown> = Promise.resolve()
let cooldownUntil = 0

export class SpotifyRateLimitError extends Error {}

// ---------- יומן בקשות (לאבחון, מוצג במסך הבדיקות) ----------
export interface RequestLogEntry {
  at: number
  method: string
  path: string
  status: number | 'error'
  retryAfter?: string | null
}
const requestLog: RequestLogEntry[] = []
export function getRequestLog(): RequestLogEntry[] {
  return [...requestLog]
}
function logRequest(e: RequestLogEntry) {
  requestLog.push(e)
  if (requestLog.length > 300) requestLog.shift()
}

// מי שרוצה לדעת שאנחנו ממתינים לספוטיפיי (כדי להציג "ממתין…" במקום מסך תקוע)
type WaitListener = (seconds: number) => void
const waitListeners = new Set<WaitListener>()
export function onRateLimitWait(fn: WaitListener): () => void {
  waitListeners.add(fn)
  return () => waitListeners.delete(fn)
}
function announceWait(seconds: number) {
  for (const fn of waitListeners) fn(seconds)
}

function waitText(sec: number) {
  return sec < 90 ? `${Math.ceil(sec)} שניות` : `${Math.ceil(sec / 60)} דקות`
}

/** כמה שניות נשארו לחסימה (0 = אין חסימה) */
export function rateLimitSecondsLeft(): number {
  return Math.max(0, (cooldownUntil - Date.now()) / 1000)
}

async function paced(): Promise<void> {
  const left = rateLimitSecondsLeft()
  if (left > MAX_INLINE_WAIT_S) {
    throw new SpotifyRateLimitError(`ספוטיפיי ביקש להאט (יותר מדי בקשות). נסו שוב בעוד ${waitText(left)}.`)
  }
  if (left > 0) {
    announceWait(left)
    await sleep(left * 1000)
  }
  const turn = gate.then(async () => {
    const wait = lastRequestAt + MIN_GAP_MS - Date.now()
    if (wait > 0) await sleep(wait)
    lastRequestAt = Date.now()
  })
  gate = turn.catch(() => undefined)
  return turn
}

export async function spotifyFetch<T>(path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
  try {
    return await spotifyFetchInner<T>(path, init, attempt)
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') throw new Error('ספוטיפיי לא ענה תוך 15 שניות. נסו שוב.')
    throw e
  }
}

async function spotifyFetchInner<T>(path: string, init: RequestInit, attempt: number): Promise<T> {
  const token = await getAccessToken()
  if (!token) throw new SpotifyAuthError('צריך להתחבר לספוטיפיי')
  await paced()
  const method = init.method ?? 'GET'
  const shortPath = (path.startsWith('http') ? new URL(path).pathname.replace('/v1', '') : path).split('?')[0]
  let res: Response
  try {
    res = await fetch(path.startsWith('http') ? path : `${BASE}${path}`, {
      signal: AbortSignal.timeout(15000), // שלא ייתקע לנצח
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
    })
  } catch (e) {
    logRequest({ at: Date.now(), method, path: shortPath, status: 'error' })
    throw e
  }
  logRequest({ at: Date.now(), method, path: shortPath, status: res.status, retryAfter: res.status === 429 ? res.headers.get('Retry-After') : undefined })
  if (res.status === 401 && attempt === 0) {
    const fresh = await getAccessToken(true)
    if (!fresh) {
      logout()
      throw new SpotifyAuthError('פג תוקף ההתחברות')
    }
    return spotifyFetchInner<T>(path, init, attempt + 1)
  }
  if (res.status === 429) {
    const asked = Math.max(1, Number(res.headers.get('Retry-After') ?? '5') || 5)
    // כל ניסיון חוזר מחכה קצת יותר מהקודם (ספוטיפיי לפעמים מבקש 5 שניות שוב ושוב)
    const wait = Math.min(MAX_INLINE_WAIT_S, Math.max(asked, 2 ** Math.min(attempt, 5)))
    // החסימה נמשכת לפחות כמה שספוטיפיי ביקש (גם אם זה יותר ממה שאנחנו מוכנים לחכות בשקט)
    cooldownUntil = Math.max(cooldownUntil, Date.now() + Math.max(wait, asked) * 1000)
    if (asked <= MAX_INLINE_WAIT_S && attempt < MAX_RATE_RETRIES) {
      announceWait(wait)
      await sleep(wait * 1000)
      return spotifyFetchInner<T>(path, init, attempt + 1)
    }
    throw new SpotifyRateLimitError(`ספוטיפיי ביקש להאט (יותר מדי בקשות). נסו שוב בעוד ${waitText(asked)}.`)
  }
  if (!res.ok) {
    let msg = `${res.status}`
    try {
      const j = await res.json()
      msg += `: ${j?.error?.message ?? JSON.stringify(j)}`
    } catch {
      /* ignore */
    }
    throw new Error(`שגיאת ספוטיפיי ${msg}`)
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    // חלק מפקודות הנגן מחזירות טקסט רגיל (למשל מזהה) ולא JSON – זה תקין
    return text as T
  }
}

export function getMe() {
  return spotifyFetch<{ id: string; display_name?: string }>('/me')
}

export function getTrack(id: string) {
  return spotifyFetch<SpotifyTrack>(`/tracks/${id}?market=from_token`)
}

export async function searchTracks(q: string, offset: number) {
  const params = new URLSearchParams({
    q,
    type: 'track',
    limit: '10',
    offset: String(offset),
    market: 'from_token',
  })
  const res = await spotifyFetch<{ tracks: { items: SpotifyTrack[]; total: number } }>(`/search?${params}`)
  return res.tracks
}

export async function getMyPlaylists(): Promise<SpotifyPlaylist[]> {
  const all: SpotifyPlaylist[] = []
  let url: string | null = '/me/playlists?limit=50'
  while (url) {
    const page: { items: (SpotifyPlaylist | null)[]; next: string | null } = await spotifyFetch(url)
    all.push(...page.items.filter((p): p is SpotifyPlaylist => p !== null))
    url = page.next
  }
  return all
}

export function playlistTotal(p: SpotifyPlaylist): number {
  return p.items?.total ?? p.tracks?.total ?? 0
}

/** כל השירים בפלייליסט (רק פלייליסטים שבבעלותי או שאני משתף בהם). */
export async function getPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
  const all: SpotifyTrack[] = []
  let url: string | null = `/playlists/${playlistId}/items?limit=50&market=from_token`
  while (url) {
    const page: {
      items: { item?: SpotifyTrack | null; track?: SpotifyTrack | null }[]
      next: string | null
    } = await spotifyFetch(url)
    for (const row of page.items) {
      const t = row.item ?? row.track
      // מדלגים על פודקאסטים, קבצים מקומיים ושירים לא זמינים
      if (t && t.id && (t.type === undefined || t.type === 'track') && !t.is_local && t.is_playable !== false) {
        all.push(t)
      }
    }
    url = page.next
  }
  return all
}
