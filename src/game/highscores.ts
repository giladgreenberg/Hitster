// טבלת שיאים לסולו: 10 התוצאות הטובות ביותר, טבלה נפרדת לכל רמת קושי + פלייליסטים.
import type { Settings } from './game'
import type { Difficulty } from './modes'

export type ScoreCategory = Difficulty | 'playlists'

export const CATEGORY_LABELS: Record<ScoreCategory, string> = {
  easy: 'אקראי – קל',
  medium: 'אקראי – בינוני',
  hard: 'אקראי – קשה',
  playlists: 'הפלייליסטים שלי',
}

export interface ScoreEntry {
  name: string
  score: number
  date: string // ISO
  category: ScoreCategory
}

export const MAX_ENTRIES = 10
const KEY = 'hitster.highscores.v1'

export function categoryOf(settings: Settings): ScoreCategory {
  return settings.source.kind === 'playlists' ? 'playlists' : (settings.source.difficulty ?? 'medium')
}

/**
 * מכניס תוצאה לטבלה (פונקציה טהורה).
 * מחזיר את הטבלה החדשה, את המקום (0 = ראשון, null = לא נכנס), והאם זה שיא חדש.
 * בתיקו – התוצאה הוותיקה נשארת לפני החדשה.
 */
export function insertScore(list: ScoreEntry[], entry: ScoreEntry): { list: ScoreEntry[]; rank: number | null; isRecord: boolean } {
  if (entry.score <= 0) return { list, rank: null, isRecord: false }
  let rank = list.findIndex((e) => entry.score > e.score)
  if (rank === -1) rank = list.length
  if (rank >= MAX_ENTRIES) return { list, rank: null, isRecord: false }
  const next = [...list.slice(0, rank), entry, ...list.slice(rank)].slice(0, MAX_ENTRIES)
  return { list: next, rank, isRecord: rank === 0 }
}

type Store = Partial<Record<ScoreCategory, ScoreEntry[]>>

function load(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Store
  } catch {
    return {}
  }
}

export function getScores(category: ScoreCategory): ScoreEntry[] {
  return load()[category] ?? []
}

export function bestScore(category: ScoreCategory): number {
  return getScores(category)[0]?.score ?? 0
}

export function saveScore(entry: ScoreEntry) {
  const store = load()
  const res = insertScore(store[entry.category] ?? [], entry)
  store[entry.category] = res.list
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    /* ignore */
  }
  return res
}
