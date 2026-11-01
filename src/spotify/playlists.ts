// פלייליסט סיכום: יוצר פלייליסט פרטי בחשבון המארח עם כל השירים שהושמעו במשחק, בסדר ההשמעה.
// Endpoints (אומתו מול התיעוד, פברואר 2026):
//   POST /me/playlists            – יצירת פלייליסט (דורש playlist-modify-private לפלייליסט פרטי)
//   POST /playlists/{id}/items    – הוספת שירים (עד 100 בבקשה; בעבר /tracks)
import { spotifyFetch } from './api'
import { hasScope, startLogin } from './auth'

export const PLAYLIST_SCOPE = 'playlist-modify-private'
const PENDING_KEY = 'hitster.pendingPlaylist'

export interface PlaylistRequest {
  name: string
  uris: string[]
}

export function summaryName(date = new Date()): string {
  return `היטסטר – ${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`
}

/** כתובות השירים לפי סדר ההשמעה, בלי כפילויות ובלי שירים שסומנו "השנה שגויה" */
export function playedUris(usedIds: string[], blacklist: Set<string>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of usedIds) {
    if (seen.has(id) || blacklist.has(id)) continue
    seen.add(id)
    out.push(`spotify:track:${id}`)
  }
  return out
}

export async function createSummaryPlaylist(req: PlaylistRequest): Promise<{ url: string; count: number }> {
  let pl: { id: string; external_urls?: { spotify?: string } }
  try {
    pl = await spotifyFetch('/me/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: req.name, public: false, description: 'השירים שהושמעו במשחק היטסטר 🎵' }),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/403/.test(msg)) {
      throw new Error('ספוטיפיי סירב ליצור פלייליסט (403). ייתכן שבמצב Development יצירת פלייליסטים חסומה כרגע לאפליקציות חדשות. פרטים: ' + msg)
    }
    throw e
  }
  for (let i = 0; i < req.uris.length; i += 100) {
    await spotifyFetch(`/playlists/${pl.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: req.uris.slice(i, i + 100) }),
    })
  }
  return { url: pl.external_urls?.spotify ?? `https://open.spotify.com/playlist/${pl.id}`, count: req.uris.length }
}

/** אם חסרה הרשאה: שומרים את הבקשה, מתחברים מחדש, ואחרי החזרה היא תבוצע אוטומטית */
export function needsRelogin(): boolean {
  return !hasScope(PLAYLIST_SCOPE)
}

export function reloginAndCreateLater(req: PlaylistRequest) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(req))
  void startLogin()
}

export function takePendingPlaylist(): PlaylistRequest | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    localStorage.removeItem(PENDING_KEY)
    return raw ? (JSON.parse(raw) as PlaylistRequest) : null
  } catch {
    return null
  }
}
