// מנוע החידונים: בחירת פריטים ויצירת שאלות אמריקאיות מתוך הנוסחאות והמילון
import { formulaById, formulas, topicById } from '../data/formulas'
import { termById, terms } from '../data/glossary'
import type { Formula, Term } from '../data/types'
import { calculators, runCalculator } from './calculators'
import { parseList, parseNum } from './finance'

export type Rng = () => number

export interface Option {
  text?: string
  tex?: string
}

export interface Question {
  /** 'f:<id>' או 't:<id>' */
  key: string
  kind: 'f2name' | 'name2f' | 'calc' | 'term2he' | 'def2term'
  /** הוראה קצרה מעל השאלה */
  ask: string
  promptTex?: string
  promptText?: string
  promptSub?: string
  options: Option[]
  answer: number
}

export function shuffle<T>(arr: T[], rng: Rng = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** הצד הימני של הנוסחה, כדי שהתשובה לא תחשוף את השם (למשל "WACC = …") */
export function formulaBody(f: Formula): string {
  const t = f.cardTex ?? f.tex
  const i = t.indexOf('=')
  if (i < 0) return t
  const rhs = t.slice(i + 1).trim()
  return rhs.replace(/\\[,;: ]/g, '').trim().length < 4 ? t : rhs
}

export const keyOf = (kind: 'f' | 't', id: string) => `${kind}:${id}`

export function exists(key: string): boolean {
  return key.startsWith('f:') ? !!formulaById[key.slice(2)] : !!termById[key.slice(2)]
}

/** מסיחים: קודם מאותו נושא, אחר כך משאר הנוסחאות, בלי כפילויות בתצוגה */
function pickFormulaDistractors(f: Formula, show: (x: Formula) => string, rng: Rng, n = 3): string[] {
  const mine = show(f)
  const seen = new Set([mine])
  const out: string[] = []
  const pools = [shuffle(formulas.filter((x) => x.topic === f.topic && x.id !== f.id), rng), shuffle(formulas.filter((x) => x.topic !== f.topic), rng)]
  for (const pool of pools)
    for (const x of pool) {
      if (out.length >= n) return out
      const s = show(x)
      if (!seen.has(s)) {
        seen.add(s)
        out.push(s)
      }
    }
  return out
}

function pickTermDistractors(t: Term, show: (x: Term) => string, rng: Rng, n = 3): string[] {
  const seen = new Set([show(t)])
  const out: string[] = []
  for (const x of shuffle(terms, rng)) {
    if (out.length >= n) break
    if (x.id === t.id) continue
    const s = show(x)
    if (!seen.has(s)) {
      seen.add(s)
      out.push(s)
    }
  }
  return out
}

function withAnswer(correct: Option, others: Option[], rng: Rng): { options: Option[]; answer: number } {
  const options = shuffle([correct, ...others], rng)
  return { options, answer: options.indexOf(correct) }
}

/** מסיחים מספריים: מריצים את המחשבון עם קלט "שגוי" (טעויות נפוצות כמו אחוז כפול, תקופה חסרה) */
export function calcDistractors(f: Formula, rng: Rng): string[] | null {
  const calc = calculators[f.id]
  if (!calc) return null
  const base = runCalculator(calc, f.example.values)
  if (base.value === null || base.error) return null
  const variants: Record<string, string | number>[] = []
  for (const inp of calc.inputs) {
    const raw = f.example.values[inp.key]
    if (inp.kind === 'list') {
      const cfs = parseList(String(raw))
      if (cfs.length > 2) {
        variants.push({ ...f.example.values, [inp.key]: cfs.slice(0, -1).join(', ') })
        variants.push({ ...f.example.values, [inp.key]: cfs.map((c, i) => (i === cfs.length - 1 ? c * 2 : c)).join(', ') })
      }
      continue
    }
    const x = parseNum(String(raw))
    const muts = inp.kind === 'int' ? [x + 1, x - 1, x * 2] : inp.kind === 'pct' ? [x * 2, x / 2, x + 2, x - 1] : [x * 1.2, x * 0.8, x * 2, x / 2]
    for (const m of muts) if (m > 0 || inp.signed) variants.push({ ...f.example.values, [inp.key]: inp.kind === 'int' ? Math.max(1, Math.round(m)) : m })
  }
  const seen = new Set([base.text])
  const out: string[] = []
  for (const v of shuffle(variants, rng)) {
    if (out.length >= 3) break
    const r = runCalculator(calc, v)
    if (r.value === null || r.error || !isFinite(r.value)) continue
    if (Math.abs(r.value - base.value) <= Math.max(1e-9, Math.abs(base.value) * 0.01)) continue
    if (seen.has(r.text)) continue
    seen.add(r.text)
    out.push(r.text)
  }
  return out.length === 3 ? out : null
}

export function makeQuestion(key: string, rng: Rng = Math.random): Question {
  if (key.startsWith('f:')) {
    const f = formulaById[key.slice(2)]
    const kinds: Question['kind'][] = ['f2name', 'name2f']
    const calcD = calculators[f.id] ? calcDistractors(f, rng) : null
    if (calcD) kinds.push('calc', 'calc')
    const kind = kinds[Math.floor(rng() * kinds.length)]
    if (kind === 'calc' && calcD) {
      const res = runCalculator(calculators[f.id], f.example.values)
      const label = res.label ? `${res.label} = ` : ''
      return { key, kind, ask: `חשבו: ${f.he}`, promptText: f.example.text, promptSub: f.en, ...withAnswer({ text: label + res.text }, calcD.map((t) => ({ text: label + t })), rng) }
    }
    if (kind === 'name2f') {
      const correct = { tex: formulaBody(f) }
      return { key, kind, ask: 'מהי הנוסחה?', promptText: f.he, promptSub: f.en, ...withAnswer(correct, pickFormulaDistractors(f, formulaBody, rng).map((tex) => ({ tex })), rng) }
    }
    const correct = { text: f.he }
    return { key, kind: 'f2name', ask: `של איזה מדד זו הנוסחה? (${topicById[f.topic].short})`, promptTex: formulaBody(f), ...withAnswer(correct, pickFormulaDistractors(f, (x) => x.he, rng).map((text) => ({ text })), rng) }
  }
  const t = termById[key.slice(2)]
  if (rng() < 0.5) {
    return { key, kind: 'term2he', ask: 'מה הפירוש של המושג?', promptText: t.en, ...withAnswer({ text: `${t.he} – ${t.short}` }, pickTermDistractors(t, (x) => `${x.he} – ${x.short}`, rng).map((text) => ({ text })), rng) }
  }
  return { key, kind: 'def2term', ask: 'איזה מושג מתאים להגדרה?', promptText: t.short, ...withAnswer({ text: t.en }, pickTermDistractors(t, (x) => x.en, rng).map((text) => ({ text })), rng) }
}

export interface Stat {
  ok: number
  bad: number
  /** האם התשובה האחרונה הייתה נכונה */
  lastOk: boolean
  at: number
}

/** בוחר פריטים לסשן: קודם מה שנכשלתם בו או שלא נבחן, ואז השאר; מעורבב */
export function pickSession(keys: string[], stats: Record<string, Stat>, count: number, rng: Rng = Math.random): string[] {
  const weight = (k: string) => {
    const s = stats[k]
    if (!s) return 2 // לא נבחן עדיין
    return (s.lastOk ? 0 : 3) + Math.min(2, s.bad - s.ok)
  }
  const ranked = shuffle(keys, rng).sort((a, b) => weight(b) - weight(a))
  return shuffle(ranked.slice(0, Math.min(count, ranked.length)), rng)
}
