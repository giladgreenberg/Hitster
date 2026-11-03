// שמירת כל מצב המשתמש ב-localStorage
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { formulas, topics } from '../data/formulas'
import type { Stat } from './quiz'

export type SortMode = 'custom' | 'alpha' | 'starred'

export interface UserState {
  /** 'f:<id>' לנוסחה, 't:<id>' למושג */
  favs: string[]
  notes: Record<string, string>
  learned: string[]
  topicOrder: string[]
  formulaOrder: Record<string, string[]>
  sort: SortMode
  recentCalcs: string[]
  calcInputs: Record<string, Record<string, string>>
  installDismissed: boolean
  /** תוצאות חידון לכל פריט */
  quizStats: Record<string, Stat>
  quizPrefs: QuizPrefs
}

export type QuizSource = 'favs' | 'formulas' | 'terms' | 'weak'
export type QuizMode = 'cards' | 'mcq'
export interface QuizPrefs {
  source: QuizSource
  mode: QuizMode
  count: number
}

const KEY = 'pocket-finance:v1'

const initial: UserState = {
  favs: [],
  notes: {},
  learned: [],
  topicOrder: topics.map((t) => t.id),
  formulaOrder: {},
  sort: 'custom',
  recentCalcs: ['npv', 'irr', 'wacc', 'current_ratio'],
  calcInputs: {},
  installDismissed: false,
  quizStats: {},
  quizPrefs: { source: 'favs', mode: 'cards', count: 10 },
}

function load(): UserState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return initial
    return { ...initial, ...JSON.parse(raw) }
  } catch {
    return initial
  }
}

interface Store {
  s: UserState
  set: (fn: (s: UserState) => Partial<UserState>) => void
  isFav: (key: string) => boolean
  toggleFav: (key: string) => void
  isLearned: (id: string) => boolean
  toggleLearned: (id: string) => void
  setNote: (key: string, text: string) => void
  orderedTopics: () => string[]
  orderedFormulas: (topic: string) => string[]
  touchCalc: (id: string) => void
  recordQuiz: (key: string, ok: boolean) => void
}

const Ctx = createContext<Store | null>(null)

/** משלב סדר שמור עם פריטים חדשים שנוספו לקובץ הנתונים */
function mergeOrder(saved: string[] | undefined, all: string[]): string[] {
  const set = new Set(all)
  const out = (saved ?? []).filter((x) => set.has(x))
  for (const x of all) if (!out.includes(x)) out.push(x)
  return out
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<UserState>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s))
    } catch {
      /* מצב פרטי / אחסון מלא */
    }
  }, [s])

  const set = useCallback((fn: (s: UserState) => Partial<UserState>) => setS((prev) => ({ ...prev, ...fn(prev) })), [])

  const store = useMemo<Store>(() => {
    const favSet = new Set(s.favs)
    const learnedSet = new Set(s.learned)
    return {
      s,
      set,
      isFav: (k) => favSet.has(k),
      toggleFav: (k) => set((p) => ({ favs: p.favs.includes(k) ? p.favs.filter((x) => x !== k) : [k, ...p.favs] })),
      isLearned: (id) => learnedSet.has(id),
      toggleLearned: (id) => set((p) => ({ learned: p.learned.includes(id) ? p.learned.filter((x) => x !== id) : [...p.learned, id] })),
      setNote: (k, text) => set((p) => ({ notes: { ...p.notes, [k]: text } })),
      orderedTopics: () => mergeOrder(s.topicOrder, topics.map((t) => t.id)),
      orderedFormulas: (topic) =>
        mergeOrder(
          s.formulaOrder[topic],
          formulas.filter((f) => f.topic === topic).map((f) => f.id),
        ),
      recordQuiz: (key, ok) =>
        set((p) => {
          const s = p.quizStats[key] ?? { ok: 0, bad: 0, lastOk: false, at: 0 }
          return { quizStats: { ...p.quizStats, [key]: { ok: s.ok + (ok ? 1 : 0), bad: s.bad + (ok ? 0 : 1), lastOk: ok, at: Date.now() } } }
        }),
      touchCalc: (id) => set((p) => ({ recentCalcs: [id, ...p.recentCalcs.filter((x) => x !== id)].slice(0, 8) })),
    }
  }, [s, set])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const v = useContext(Ctx)
  if (!v) throw new Error('StoreProvider missing')
  return v
}
