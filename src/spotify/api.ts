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
  const res = await fetch(path.startsWith('http') ? path : `${BASE}${path}`, {
    signal: AbortSignal.timeout(15000), // שלא ייתקע לנצח
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  })
  if (res.status === 401 && attempt === 0) {
    const fresh = await getAccessToken(true)
    if (!fresh) {
      logout()
      throw new SpotifyAuthError('פג תוקף ההתחברות')
    }
    return spotifyFetchInner<T>(path, init, attempt + 1)
  }
  if (res.status === 429 && attempt < 3) {
    const wait = Number(res.headers.get('Retry-After') ?? '2')
    await sleep(Math.min(wait, 30) * 1000)
    return spotifyFetchInner<T>(path, init, attempt + 1)
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
