// מקורות שירים: פלייליסטים שלי / אקראי מספוטיפיי (חיפוש לפי שנה וז'אנר).

import { getPlaylistTracks, searchTracks, type SpotifyTrack } from '../spotify/api'
import { getBlacklist } from './blacklist'
import { resolveSong } from './resolveSong'
import { offsetRange, passesDifficulty } from './difficulty'

/** כמה שירים ברצף מותר לדחות בגלל רמת הקושי לפני שמוותרים על הסינון לשיר הזה */
const MAX_DIFFICULTY_REJECTS = 4
import type { Song } from './types'
import type { Difficulty } from '../game/modes'

export type SourceConfig =
  | { kind: 'playlists'; playlistIds: string[] }
  | { kind: 'random'; fromYear: number; toYear: number; genres: string[]; difficulty?: Difficulty }

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
    private difficulty: Difficulty = 'medium',
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

  /**
   * מאגר מועמדים מהחיפושים האחרונים. כל חיפוש מחזיר עד 10 שירים – משתמשים בכולם
   * (במקום לזרוק 9), וכך שולחים לספוטיפיי הרבה פחות בקשות. כדי לגוון, שולפים מהמאגר
   * באקראי וממלאים אותו מחדש כשהוא מתרוקן, כך שהוא מערבב כמה שנים וז'אנרים.
   */
  private pool: SpotifyTrack[] = []
  private static POOL_REFILL_BELOW = 6
  /** כמה שירים לכל היותר לוקחים מכל עמוד (שלא יבואו הרבה שירים מאותה שנה ברצף) */
  private static PER_PAGE = 5

  async nextCandidate() {
    if (this.pool.length < RandomSearchSource.POOL_REFILL_BELOW) {
      const added = await this.searchOnce()
      if (added === null) return this.pool.length ? this.takeFromPool() : null
      if (added === 0 && this.pool.length === 0) return undefined
    }
    return this.takeFromPool()
  }

  private takeFromPool(): SpotifyTrack | undefined {
    if (!this.pool.length) return undefined
    const i = randInt(0, this.pool.length - 1)
    return this.pool.splice(i, 1)[0]
  }

  /** חיפוש אחד: מוסיף מועמדים למאגר. מחזיר כמה נוספו, או null אם אין יותר מה לחפש. */
  private async searchOnce(): Promise<number | null> {
    const choice = this.pick()
    if (!choice) {
      // כמעט כל הצירופים ריקים – ננסה בלי ז'אנר, רק לפי שנה
      if (this.genres.length === 0) return null
      this.genres = []
      return 0
    }
    const { genre, q } = choice

    // הטווח שממנו מגרילים תלוי ברמת הקושי (קל = התוצאות הראשונות = הכי מוכרות).
    // אם עוד לא יודעים כמה תוצאות יש, מנחשים שיש הרבה – ורק אם העמוד יצא ריק, מנסים שוב בטווח האמיתי.
    const pickOffset = (total: number) => {
      const [lo, hi] = offsetRange(this.difficulty, total)
      return randInt(lo, Math.max(lo, hi))
    }
    const known = this.totals.get(q)
    let page = await searchTracks(q, pickOffset(known ?? 1000))
    this.totals.set(q, page.total)
    if (!page.items.length && page.total > 0) {
      page = await searchTracks(q, pickOffset(page.total))
    }

    if (!page.items.length) {
      this.empty.add(q)
      if (genre) {
        const misses = (this.genreMisses.get(genre) ?? 0) + 1
        this.genreMisses.set(genre, misses)
        // ז'אנר שיצא ריק 6 פעמים ברצף – כנראה לא קיים בספוטיפיי בשם הזה
        if (misses >= 6 && this.genres.length > 1) this.genres = this.genres.filter((g) => g !== genre)
      }
      return 0
    }
    if (genre) this.genreMisses.set(genre, 0)
    const items = [...page.items].sort(() => Math.random() - 0.5).slice(0, RandomSearchSource.PER_PAGE)
    this.pool.push(...items)
    return items.length
  }
}

/** מחזיר את מקור השירים לפי ההגדרות, עם סינון כפילויות/רשימה שחורה ובדיקת שנה. */
export function createSongSource(config: SourceConfig, log: SourceLog = () => {}) {
  const inner: CandidateSource =
    config.kind === 'playlists'
      ? new PlaylistSource(config.playlistIds)
      : new RandomSearchSource(config.fromYear, config.toYear, config.genres, config.difficulty ?? 'medium')
  const used = new Set<string>()
  // בפלייליסט ממשיכים עד שהוא נגמר; באקראי – מספר ניסיונות גדול ואז שגיאה (לא "נגמר")
  const maxAttempts = config.kind === 'playlists' ? Infinity : 80
  let difficultyRejects = 0

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
        const difficulty = config.kind === 'random' ? config.difficulty : undefined
        const needReleases = difficulty === 'easy' || difficulty === 'hard'
        const r = await resolveSong(t, needReleases)
        // סינון לפי קושי הוא "רך": אחרי כמה דחיות ברצף מקבלים את השיר בכל זאת
        // (עומק החיפוש עדיין שומר על רמת הקושי) – כדי שלא נתקע על שירים בלי מידע ב-MusicBrainz
        if (r.ok && needReleases && difficultyRejects < MAX_DIFFICULTY_REJECTS && !passesDifficulty(difficulty, r.song.mbReleases)) {
          difficultyRejects++
          log(`✗ דילוג: ${t.name} – לא מתאים לרמת הקושי (${r.song.mbReleases ?? '?'} הוצאות)`)
          continue
        }
        if (r.ok) difficultyRejects = 0
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
