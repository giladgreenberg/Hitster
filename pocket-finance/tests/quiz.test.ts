import { describe, expect, test } from 'vitest'
import { formulas, formulaById } from '../src/data/formulas'
import { terms } from '../src/data/glossary'
import { calculators, runCalculator } from '../src/lib/calculators'
import { calcDistractors, formulaBody, makeQuestion, pickSession } from '../src/lib/quiz'
import katex from 'katex'

// מחולל מספרים דטרמיניסטי לבדיקות
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

const sig = (o: { text?: string; tex?: string }) => o.tex ?? o.text

describe('חידון', () => {
  test('כל נוסחה ומושג מייצרים שאלה תקינה בכל הסוגים', () => {
    const keys = [...formulas.map((f) => 'f:' + f.id), ...terms.map((t) => 't:' + t.id)]
    const kinds = new Set<string>()
    for (const key of keys) {
      for (let s = 1; s <= 12; s++) {
        const q = makeQuestion(key, seeded(s * 97 + key.length))
        kinds.add(q.kind)
        expect(q.options.length, key).toBe(4)
        expect(new Set(q.options.map(sig)).size, `${key} ${q.kind}`).toBe(4)
        expect(q.answer).toBeGreaterThanOrEqual(0)
        expect(q.answer).toBeLessThan(4)
        for (const o of q.options) if (o.tex) expect(() => katex.renderToString(o.tex!, { throwOnError: true, strict: false })).not.toThrow()
        if (q.kind === 'calc') {
          const f = formulaById[key.slice(2)]
          const r = runCalculator(calculators[f.id], f.example.values)
          expect(q.options[q.answer].text).toContain(r.text)
        }
        if (q.kind === 'f2name') expect(q.options[q.answer].text).toBe(formulaById[key.slice(2)].he)
      }
    }
    expect([...kinds].sort()).toEqual(['calc', 'def2term', 'f2name', 'name2f', 'term2he'])
  })

  test('גוף הנוסחה לא חושף את שם המדד', () => {
    expect(formulaBody(formulaById.wacc)).not.toContain('WACC')
    expect(formulaBody(formulaById.npv)).not.toMatch(/^NPV/)
    expect(formulaBody(formulaById.irr).length).toBeGreaterThan(3)
  })

  test('מסיחים מספריים קיימים לרוב המחשבונים', () => {
    const ok = formulas.filter((f) => calcDistractors(f, seeded(3)))
    expect(ok.length).toBeGreaterThan(formulas.length * 0.8)
  })

  test('בחירת סשן מעדיפה פריטים שנכשלו', () => {
    const keys = ['f:npv', 'f:irr', 'f:wacc', 'f:capm']
    const stats = { 'f:npv': { ok: 5, bad: 0, lastOk: true, at: 1 }, 'f:irr': { ok: 0, bad: 2, lastOk: false, at: 1 }, 'f:wacc': { ok: 3, bad: 0, lastOk: true, at: 1 }, 'f:capm': { ok: 2, bad: 0, lastOk: true, at: 1 } }
    for (let s = 1; s < 20; s++) expect(pickSession(keys, stats, 1, seeded(s))).toEqual(['f:irr'])
    expect(pickSession(keys, stats, 99, seeded(1)).sort()).toEqual([...keys].sort())
  })
})
