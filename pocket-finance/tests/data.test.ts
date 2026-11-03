import { describe, expect, test } from 'vitest'
import { formulas, formulaById, topics } from '../src/data/formulas'
import { terms, termById } from '../src/data/glossary'
import { calculators, runCalculator } from '../src/lib/calculators'
import { irr, npv, parseList } from '../src/lib/finance'
import katex from 'katex'

describe('נוסחאות ומחשבונים', () => {
  test('מזהים ייחודיים ונושאים קיימים', () => {
    expect(new Set(formulas.map((f) => f.id)).size).toBe(formulas.length)
    const topicIds = new Set(topics.map((t) => t.id))
    for (const f of formulas) expect(topicIds.has(f.topic), f.id).toBe(true)
  })

  for (const f of formulas) {
    test(`המחשבון של ${f.id} מחזיר את תוצאת הדוגמה`, () => {
      const c = calculators[f.id]
      expect(c, `missing calculator ${f.id}`).toBeDefined()
      // לכל שדה במחשבון יש ערך ברירת מחדל בדוגמה
      for (const inp of c.inputs) expect(f.example.values[inp.key], `${f.id}.${inp.key}`).not.toBeUndefined()
      const r = runCalculator(c, f.example.values)
      expect(r.error, f.id).toBeUndefined()
      expect(r.value).not.toBeNull()
      const tol = Math.max(0.006, Math.abs(f.example.result) * 1e-4)
      expect(Math.abs((r.value as number) - f.example.result), `${f.id}: ${r.value} vs ${f.example.result}`).toBeLessThan(tol)
      expect(r.steps.length).toBeGreaterThan(0)
    })
  }

  test('כל ה-TeX מתקמפל ב-KaTeX', () => {
    for (const f of formulas) {
      for (const tex of [f.tex, f.cardTex, ...f.vars.map((v) => v[0])].filter(Boolean) as string[]) {
        expect(() => katex.renderToString(tex, { throwOnError: true, strict: false }), `${f.id}: ${tex}`).not.toThrow()
      }
      const r = runCalculator(calculators[f.id], f.example.values)
      for (const step of r.steps) {
        const parts = step.split('$').filter((_, i) => i % 2 === 1)
        for (const p of parts) expect(() => katex.renderToString(p, { throwOnError: true, strict: false }), `${f.id}: ${p}`).not.toThrow()
      }
    }
  })
})

describe('IRR', () => {
  test('פתרון יחיד', () => {
    const r = irr([-1000, 300, 400, 500, 200])
    expect(r.roots).toHaveLength(1)
    expect(npv(r.roots[0], [-1000, 300, 400, 500, 200])).toBeCloseTo(0, 6)
  })
  test('כמה פתרונות (תזרים לא קונבנציונלי)', () => {
    // NPV = 0 ב-10% וב-20%
    const cfs = [-100, 230, -132]
    const r = irr(cfs)
    expect(r.roots.map((x) => +x.toFixed(6))).toEqual([0.1, 0.2])
    const res = runCalculator(calculators.irr, { cfs: '-100, 230, -132', k: 10 })
    expect(res.badge?.text).toContain('פתרונות')
  })
  test('אין פתרון', () => {
    const res = runCalculator(calculators.irr, { cfs: '1000, 300, 400', k: 10 })
    expect(res.value).toBeNull()
    expect(res.error).toBeTruthy()
  })
  test('פענוח רשימה', () => {
    expect(parseList('−1000, 300; 400 500')).toEqual([-1000, 300, 400, 500])
  })
})

describe('מילון', () => {
  test('לפחות 150 מושגים, מזהים ייחודיים', () => {
    expect(terms.length).toBeGreaterThanOrEqual(150)
    expect(new Set(terms.map((t) => t.id)).size).toBe(terms.length)
  })
  test('ממוין לפי סדר אלפביתי באנגלית', () => {
    for (let i = 1; i < terms.length; i++) {
      expect(terms[i - 1].en.localeCompare(terms[i].en, 'en', { sensitivity: 'base' })).toBeLessThanOrEqual(0)
    }
  })
  test('כל קישור לנוסחה מוביל לנוסחה קיימת', () => {
    for (const t of terms) if (t.formula) expect(formulaById[t.formula], `${t.id} → ${t.formula}`).toBeDefined()
  })
  test('כל מושג קשור קיים', () => {
    for (const t of terms) for (const r of t.related ?? []) expect(termById[r], `${t.id} → ${r}`).toBeDefined()
  })
  test('קישורים מרכזיים מובילים לנוסחה הנכונה', () => {
    expect(termById['beta'].formula).toBe('capm')
    expect(termById['wacc'].formula).toBe('wacc')
    expect(termById['npv'].formula).toBe('npv')
    expect(termById['current-ratio'].formula).toBe('current_ratio')
    expect(termById['yield-to-maturity'].formula).toBe('ytm')
  })
})
