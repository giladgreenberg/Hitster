// מקורות שירים: פלייליסטים שלי / אקראי מספוטיפיי (חיפוש לפי שנה וז'אנר).

import { getPlaylistTracks, searchTracks, type SpotifyTrack } from '../spotify/api'
import { getBlacklist } from './blacklist'
import { resolveSong } from './resolveSong'
import type { Song } from './types'

export type SourceConfig =
  | { kind: 'playlists'; playlistIds: string[] }
  | { kind: 'random'; fromYear: number; toYear: number; genres: string[] }

export interface SourceLog {
  (msg: string): void
}

const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1))

/** מקור שמחזיר בכל קריאה מועמד אקראי (עדיין בלי בדיקת שנה). */
interface CandidateSource {
  nextCandidate(): Promise<SpotifyTrack | null>
}

class PlaylistSource implements CandidateSource {
  private pool: SpotifyTrack[] | null = null
  constructor(private ids: string[]) {}

  private async load() {
    const all = (await Promise.all(this.ids.map((id) => getPlaylistTracks(id)))).flat()
    const seen = new Set<string>()
    this.pool = all.filter((t) => !seen.has(t.id) && seen.add(t.id))
    // ערבוב Fisher-Yates
    for (let i = this.pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[this.pool[i], this.pool[j]] = [this.pool[j], this.pool[i]]
    }
  }

  async nextCandidate() {
    if (!this.pool) await this.load()
    return this.pool!.pop() ?? null
  }

  async size() {
    if (!this.pool) await this.load()
    return this.pool!.length
  }
}

class RandomSearchSource implements CandidateSource {
  private totals = new Map<string, number>()
  constructor(
    private fromYear: number,
    private toYear: number,
    private genres: string[],
  ) {}

  async nextCandidate() {
    const year = randInt(this.fromYear, this.toYear)
    const genre = this.genres.length ? this.genres[randInt(0, this.genres.length - 1)] : null
    const q = `year:${year}` + (genre ? ` genre:"${genre}"` : '')

    // ספוטיפיי מאפשר offset עד 1000, ובכל בקשה עד 10 תוצאות.
    // בפעם הראשונה לכל שאילתה לומדים כמה תוצאות יש, ואז מגרילים offset בטווח.
    let total = this.totals.get(q)
    let offset = total === undefined ? randInt(0, 50) : randInt(0, Math.max(0, Math.min(total, 1000) - 10))
    let page = await searchTracks(q, offset)
    if (page.items.length === 0 && offset > 0) {
      offset = randInt(0, Math.max(0, Math.min(page.total, 1000) - 10))
      page = await searchTracks(q, offset)
    }
    this.totals.set(q, page.total)
    total = page.total
    if (!page.items.length) return null
    return page.items[randInt(0, page.items.length - 1)]
  }
}

/** מחזיר את מקור השירים לפי ההגדרות, עם סינון כפילויות/רשימה שחורה ובדיקת שנה. */
export function createSongSource(config: SourceConfig, log: SourceLog = () => {}) {
  const inner: CandidateSource =
    config.kind === 'playlists'
      ? new PlaylistSource(config.playlistIds)
      : new RandomSearchSource(config.fromYear, config.toYear, config.genres)
  const used = new Set<string>()

  return {
    /** מסמן שיר כמשומש (למשל אחרי שחזור משחק שמור) */
    markUsed(id: string) {
      used.add(id)
    },
    /** השיר הבא עם שנה מקורית אמינה, או null אם המקור נגמר */
    async next(maxAttempts = 25): Promise<Song | null> {
      const blacklist = getBlacklist()
      for (let i = 0; i < maxAttempts; i++) {
        const t = await inner.nextCandidate()
        if (!t) return null
        if (used.has(t.id) || blacklist.has(t.id)) continue
        used.add(t.id)
        const r = await resolveSong(t)
        if (r.ok) {
          log(`✓ ${t.name} – ${r.song.year} (${r.song.yearSource === 'musicbrainz' ? 'MusicBrainz' : 'ספוטיפיי'})`)
          return r.song
        }
        log(`✗ דילוג: ${t.name} – ${r.reason}`)
      }
      return null
    },
  }
}

export type SongSource = ReturnType<typeof createSongSource>
