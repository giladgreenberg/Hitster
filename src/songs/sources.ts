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

/**
 * מקור שמחזיר בכל קריאה מועמד אקראי (עדיין בלי בדיקת שנה).
 * null = המקור נגמר באמת; undefined = הפעם לא נמצא כלום, אפשר לנסות שוב.
 */
interface CandidateSource {
  nextCandidate(): Promise<SpotifyTrack | null | undefined>
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
}

export class RandomSearchSource implements CandidateSource {
  private totals = new Map<string, number>()
  /** צירופי שנה+ז'אנר שהחזירו 0 תוצאות – לא מגרילים אותם שוב */
  private empty = new Set<string>()
  /** כמה פעמים כל ז'אנר יצא ריק ברצף – ז'אנר "מת" יוצא מההגרלה */
  private genreMisses = new Map<string, number>()
  private genres: string[]

  constructor(
    private fromYear: number,
    private toYear: number,
    genres: string[],
  ) {
    this.genres = [...genres]
  }

  private query(year: number, genre: string | null) {
    return `year:${year}` + (genre ? ` genre:"${genre}"` : '')
  }

  /** מגריל צירוף שעוד לא ידוע שהוא ריק */
  private pick(): { year: number; genre: string | null; q: string } | null {
    for (let i = 0; i < 40; i++) {
      const year = randInt(this.fromYear, this.toYear)
      const genre = this.genres.length ? this.genres[randInt(0, this.genres.length - 1)] : null
      const q = this.query(year, genre)
      if (!this.empty.has(q)) return { year, genre, q }
    }
    return null
  }

  async nextCandidate() {
    const choice = this.pick()
    if (!choice) {
      // כמעט כל הצירופים ריקים – ננסה בלי ז'אנר, רק לפי שנה
      if (this.genres.length === 0) return null
      this.genres = []
      return undefined
    }
    const { genre, q } = choice

    // ספוטיפיי מאפשר offset עד 1000, ובכל בקשה עד 10 תוצאות.
    // בפעם הראשונה לכל שאילתה לומדים כמה תוצאות יש, ואז מגרילים offset בטווח.
    const known = this.totals.get(q)
    let offset = known === undefined ? 0 : randInt(0, Math.max(0, Math.min(known, 1000) - 10))
    let page = await searchTracks(q, offset)
    this.totals.set(q, page.total)
    if (known === undefined && page.total > 10) {
      // עכשיו כשיודעים כמה יש – מגרילים עמוד אקראי (כדי לגוון, לא תמיד הלהיטים הראשונים)
      offset = randInt(0, Math.max(0, Math.min(page.total, 1000) - 10))
      if (offset >= 10) page = await searchTracks(q, offset)
    }

    if (!page.items.length) {
      this.empty.add(q)
      if (genre) {
        const misses = (this.genreMisses.get(genre) ?? 0) + 1
        this.genreMisses.set(genre, misses)
        // ז'אנר שיצא ריק 6 פעמים ברצף – כנראה לא קיים בספוטיפיי בשם הזה
        if (misses >= 6 && this.genres.length > 1) this.genres = this.genres.filter((g) => g !== genre)
      }
      return undefined
    }
    if (genre) this.genreMisses.set(genre, 0)
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
  // בפלייליסט ממשיכים עד שהוא נגמר; באקראי – מספר ניסיונות גדול ואז שגיאה (לא "נגמר")
  const maxAttempts = config.kind === 'playlists' ? Infinity : 80

  return {
    /** מסמן שיר כמשומש (למשל אחרי שחזור משחק שמור) */
    markUsed(id: string) {
      used.add(id)
    },
    /** השיר הבא עם שנה מקורית אמינה, או null אם המקור נגמר באמת */
    async next(): Promise<Song | null> {
      const blacklist = getBlacklist()
      for (let i = 0; i < maxAttempts; i++) {
        const t = await inner.nextCandidate()
        if (t === null) return null
        if (t === undefined) continue
        if (used.has(t.id) || blacklist.has(t.id)) continue
        used.add(t.id)
        const r = await resolveSong(t)
        if (r.ok) {
          log(`✓ ${t.name} – ${r.song.year} (${r.song.yearSource === 'musicbrainz' ? 'MusicBrainz' : 'ספוטיפיי'})`)
          return r.song
        }
        log(`✗ דילוג: ${t.name} – ${r.reason}`)
      }
      throw new Error('לא הצלחתי למצוא שיר מתאים כרגע. נסו שוב, או הרחיבו את טווח השנים.')
    },
  }
}

export type SongSource = ReturnType<typeof createSongSource>
