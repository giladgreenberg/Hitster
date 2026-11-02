// קריאות ל-Spotify Web API.
// הערות לפי שינויי מצב Development (פברואר–מרץ 2026):
// - search מחזיר עד 10 תוצאות לבקשה.
// - אין GET /tracks (כמה שירים יחד) – שולפים כל שיר בנפרד עם GET /tracks/{id}.
// - תוכן פלייליסט: GET /playlists/{id}/items, וכל שורה מכילה item (בעבר track).
// - external_ids (ISRC) הוסר בפברואר אבל הוחזר במרץ 2026.

import { getAccessToken, getClientId, logout } from './auth'

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
let lastRequestAt = 0
let gate: Promise<unknown> = Promise.resolve()
// החסימה נשמרת גם ברענון – אחרת רענון שולח בקשות מיד ומאריך את החסימה אצל ספוטיפיי
// החסימה שייכת ל-Client ID מסוים: אפליקציה חדשה בספוטיפיי = מכסה חדשה, בלי החסימה הישנה
const cooldownKey = () => {
  try {
    return `hitster.spotifyCooldownUntil.${getClientId()}`
  } catch {
    return 'hitster.spotifyCooldownUntil'
  }
}
let cooldownUntil = 0
let cooldownFor = ''
function syncCooldown() {
  const key = cooldownKey()
  if (key === cooldownFor) return
  cooldownFor = key
  try {
    cooldownUntil = Number(localStorage.getItem(key) ?? 0) || 0
  } catch {
    cooldownUntil = 0
  }
}
function setCooldown(until: number) {
  syncCooldown()
  cooldownUntil = Math.max(cooldownUntil, until)
  try {
    localStorage.setItem(cooldownKey(), String(cooldownUntil))
  } catch {
    /* ignore */
  }
}
// 429 ברצף בלי הצלחה באמצע – כל אחד מכפיל את ההמתנה (כשספוטיפיי לא אומר כמה לחכות)
let consecutive429 = 0

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
  syncCooldown()
  return Math.max(0, (cooldownUntil - Date.now()) / 1000)
}

// בלם כללי: לכל היותר WINDOW_MAX בקשות בכל 30 שניות – גם אם באג כלשהו בקוד מנסה לשלוח יותר.
// כך האפליקציה לעולם לא "מציפה" את ספוטיפיי ולא נחסמת.
const WINDOW_MS = 30_000
const WINDOW_MAX = 20
const sent: number[] = []
export function requestsInWindow(): number {
  const now = Date.now()
  while (sent.length && now - sent[0] > WINDOW_MS) sent.shift()
  return sent.length
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
    // הגענו לתקרה בחלון של 30 שניות? מחכים עד שמתפנה מקום
    while (requestsInWindow() >= WINDOW_MAX) {
      const free = sent[0] + WINDOW_MS - Date.now() + 50
      announceWait(free / 1000)
      await sleep(free)
    }
    lastRequestAt = Date.now()
    sent.push(lastRequestAt)
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
    consecutive429++
    const header = res.headers.get('Retry-After')
    // אם ספוטיפיי לא אמר כמה לחכות (או שהדפדפן לא מאפשר לקרוא את זה) – מניחים המתנה ארוכה
    // שמתארכת: 30 שניות, דקה, 2, 4, 8… עד שעה. עדיף לחכות יותר מאשר להאריך את החסימה.
    const asked = header !== null && Number(header) > 0 ? Number(header) : Math.min(3600, 30 * 2 ** (consecutive429 - 1))
    const wait = Math.min(MAX_INLINE_WAIT_S, Math.max(asked, 2 ** Math.min(attempt, 5)))
    // החסימה נמשכת לפחות כמה שספוטיפיי ביקש (גם אם זה יותר ממה שאנחנו מוכנים לחכות בשקט)
    setCooldown(Date.now() + Math.max(wait, asked) * 1000)
    if (asked <= MAX_INLINE_WAIT_S && attempt < 3) {
      announceWait(wait)
      await sleep(wait * 1000)
      return spotifyFetchInner<T>(path, init, attempt + 1)
    }
    throw new SpotifyRateLimitError(`ספוטיפיי ביקש להאט (יותר מדי בקשות). נסו שוב בעוד ${waitText(asked)}.`)
  }
  if (res.ok) consecutive429 = 0
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
