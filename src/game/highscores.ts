// טבלת שיאים לסולו: 10 התוצאות הטובות ביותר, טבלה נפרדת לכל רמת קושי + פלייליסטים.
import type { Settings } from './game'
import type { Difficulty } from './modes'

export type ScoreCategory = Difficulty | 'playlists'
/** 'all' = טבלה כללית לכל משחקי הסולו */
export type ScoreTableId = ScoreCategory | 'all'

export const CATEGORY_LABELS: Record<ScoreTableId, string> = {
  all: '🌍 כללי',
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
  if (entry.score < 0) return { list, rank: null, isRecord: false }
  let rank = list.findIndex((e) => entry.score > e.score)
  if (rank === -1) rank = list.length
  if (rank >= MAX_ENTRIES) return { list, rank: null, isRecord: false }
  const next = [...list.slice(0, rank), entry, ...list.slice(rank)].slice(0, MAX_ENTRIES)
  // שיא = מקום ראשון עם יותר מ-0 נקודות
  return { list: next, rank, isRecord: rank === 0 && entry.score > 0 }
}

type Store = Partial<Record<ScoreTableId, ScoreEntry[]>>

function load(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Store
  } catch {
    return {}
  }
}

/** מאחד כמה טבלאות לטבלה אחת (לבניית הטבלה הכללית מתוצאות ישנות) */
export function mergeTables(tables: ScoreEntry[][]): ScoreEntry[] {
  return tables
    .flat()
    .sort((a, b) => b.score - a.score || a.date.localeCompare(b.date))
    .slice(0, MAX_ENTRIES)
}

export function getScores(table: ScoreTableId): ScoreEntry[] {
  const store = load()
  if (table === 'all' && !store.all) {
    // תוצאות שנשמרו לפני שהייתה טבלה כללית
    return mergeTables([store.easy ?? [], store.medium ?? [], store.hard ?? [], store.playlists ?? []])
  }
  return store[table] ?? []
}

export function bestScore(category: ScoreTableId): number {
  return getScores(category)[0]?.score ?? 0
}

const LAST_KEY = 'hitster.highscores.last'

/** הקטגוריה של המשחק האחרון – כדי לפתוח את מסך השיאים בלשונית הנכונה */
export function lastCategory(): ScoreCategory {
  return (localStorage.getItem(LAST_KEY) as ScoreCategory | null) ?? 'medium'
}

export function saveScore(entry: ScoreEntry) {
  try {
    localStorage.setItem(LAST_KEY, entry.category)
  } catch {
    /* ignore */
  }
  const store = load()
  const overallBefore = getScores('all')
  const res = insertScore(store[entry.category] ?? [], entry)
  const overall = insertScore(overallBefore, entry)
  store[entry.category] = res.list
  store.all = overall.list
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    /* ignore */
  }
  return { ...res, overallRank: overall.rank, overallRecord: overall.isRecord }
}
