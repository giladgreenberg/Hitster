// סטטיסטיקות סוף משחק – מחושבות מיומן האירועים.
import type { GameEvent } from './events'

/** אירועי מיקום של השחקן/קבוצה עצמם (בלי קניות ובלי אתגרים) */
const placements = (events: GameEvent[]) => events.filter((e) => e.how === 'placed' || e.how === 'timeout')

export const decadeOf = (year: number) => Math.floor(year / 10) * 10

export interface DecadeStat {
  decade: number
  correct: number
  total: number
  rate: number
}

/**
 * העשור החזק של כל שחקן: העשור עם אחוז ההצלחה הגבוה ביותר, רק עשורים עם 2 שירים לפחות.
 * בתיקו: יותר שירים, ואז העשור המוקדם יותר.
 */
export function strongestDecades(events: GameEvent[]): Map<string, DecadeStat | null> {
  const byActor = new Map<string, Map<number, { correct: number; total: number }>>()
  for (const e of placements(events)) {
    const decades = byActor.get(e.actor) ?? new Map()
    const d = decades.get(decadeOf(e.year)) ?? { correct: 0, total: 0 }
    d.total++
    if (e.correct) d.correct++
    decades.set(decadeOf(e.year), d)
    byActor.set(e.actor, decades)
  }
  const out = new Map<string, DecadeStat | null>()
  for (const [actor, decades] of byActor) {
    let best: DecadeStat | null = null
    for (const [decade, { correct, total }] of decades) {
      if (total < 2) continue
      const cand = { decade, correct, total, rate: correct / total }
      if (!best || cand.rate > best.rate || (cand.rate === best.rate && (cand.total > best.total || (cand.total === best.total && cand.decade < best.decade)))) {
        best = cand
      }
    }
    out.set(actor, best)
  }
  return out
}

/** כמה שנים השחקן "פספס": המרחק בין השנה האמיתית לטווח שבו מיקם (0 = בתוך הטווח) */
export function missDistance(e: Pick<GameEvent, 'year' | 'before' | 'after'>): number {
  if (e.before !== null && e.year < e.before) return e.before - e.year
  if (e.after !== null && e.year > e.after) return e.year - e.after
  return 0
}

export interface BiggestMiss {
  actor: string
  songName: string
  artists: string
  year: number
  distance: number
}

/** הטעות הכי גדולה במשחק (רק טעויות עם מיקום בפועל) */
export function biggestMiss(events: GameEvent[]): BiggestMiss | null {
  let best: BiggestMiss | null = null
  for (const e of events) {
    if (e.correct || e.slot === null || (e.how !== 'placed' && e.how !== 'challenge')) continue
    const distance = missDistance(e)
    if (distance > 0 && (!best || distance > best.distance)) {
      best = { actor: e.actor, songName: e.songName, artists: e.artists, year: e.year, distance }
    }
  }
  return best
}

export type Highlight =
  | { type: 'exact'; actor: string; songName: string; year: number }
  | { type: 'streak'; actor: string; length: number }
  | { type: 'dense'; actor: string; songName: string; size: number }

/** הרצף הארוך ביותר של מיקומים נכונים ברצף, לכל שחקן */
export function longestStreak(events: GameEvent[]): { actor: string; length: number } | null {
  const current = new Map<string, number>()
  let best: { actor: string; length: number } | null = null
  for (const e of placements(events)) {
    const n = e.correct ? (current.get(e.actor) ?? 0) + 1 : 0
    current.set(e.actor, n)
    if (n > 0 && (!best || n > best.length)) best = { actor: e.actor, length: n }
  }
  return best
}

/**
 * רגע השיא, לפי סדר עדיפות:
 * 1. קליעה לשנה המדויקת – בשיר הכי ישן שבו קרה
 * 2. הרצף הארוך ביותר של מיקומים נכונים (2 לפחות)
 * 3. מיקום נכון בציר הכי צפוף
 */
export function highlight(events: GameEvent[]): Highlight | null {
  const exact = events.filter((e) => e.exactHit).sort((a, b) => a.year - b.year)[0]
  if (exact) return { type: 'exact', actor: exact.actor, songName: exact.songName, year: exact.year }

  const streak = longestStreak(events)
  if (streak && streak.length >= 2) return { type: 'streak', ...streak }

  const dense = placements(events)
    .filter((e) => e.correct)
    .sort((a, b) => b.timelineSize - a.timelineSize)[0]
  if (dense) return { type: 'dense', actor: dense.actor, songName: dense.songName, size: dense.timelineSize + 1 }
  return null
}

/** אחוז הצלחה כללי לכל שחקן */
export function accuracy(events: GameEvent[]): Map<string, { correct: number; total: number }> {
  const out = new Map<string, { correct: number; total: number }>()
  for (const e of placements(events)) {
    const a = out.get(e.actor) ?? { correct: 0, total: 0 }
    a.total++
    if (e.correct) a.correct++
    out.set(e.actor, a)
  }
  return out
}
