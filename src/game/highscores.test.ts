import { describe, expect, it } from 'vitest'
import { insertScore, MAX_ENTRIES, mergeTables, type ScoreEntry } from './highscores'

const e = (score: number, name = 'א'): ScoreEntry => ({ name, score, date: '2026-11-01', category: 'medium' })

describe('טבלת שיאים', () => {
  it('טבלה ריקה – התוצאה הראשונה היא שיא', () => {
    expect(insertScore([], e(3))).toMatchObject({ rank: 0, isRecord: true })
  })
  it('נכנס במקום הנכון לפי ניקוד', () => {
    const list = [e(10), e(7), e(3)]
    const r = insertScore(list, e(5))
    expect(r.rank).toBe(2)
    expect(r.isRecord).toBe(false)
    expect(r.list.map((x) => x.score)).toEqual([10, 7, 5, 3])
  })
  it('בתיקו – הוותיק נשאר לפני', () => {
    const r = insertScore([e(5, 'ותיק')], e(5, 'חדש'))
    expect(r.rank).toBe(1)
    expect(r.list.map((x) => x.name)).toEqual(['ותיק', 'חדש'])
  })
  it('שומר רק 10, ותוצאה נמוכה מדי לא נכנסת', () => {
    const full = Array.from({ length: MAX_ENTRIES }, (_, i) => e(20 - i))
    expect(insertScore(full, e(5)).rank).toBe(null)
    const r = insertScore(full, e(15))
    expect(r.list).toHaveLength(MAX_ENTRIES)
    expect(r.list.at(-1)!.score).toBe(12)
  })
  it('ניקוד 0 נשמר בטבלה, אבל לא נחשב "שיא"', () => {
    expect(insertScore([], e(0))).toMatchObject({ rank: 0, isRecord: false })
    expect(insertScore([e(3)], e(0)).rank).toBe(1)
  })
  it('טבלה כללית: מאחדת את כל הקטגוריות, ממיינת ושומרת 10', () => {
    const easy = [e(9, 'קל'), e(2, 'קל2')].map((x) => ({ ...x, category: 'easy' as const }))
    const hard = Array.from({ length: 10 }, (_, i) => ({ ...e(i, 'קשה' + i), category: 'hard' as const }))
    const all = mergeTables([easy, hard])
    expect(all).toHaveLength(MAX_ENTRIES)
    expect(all[0]).toMatchObject({ name: 'קל', score: 9 }) // תיקו באותו תאריך – הסדר המקורי נשמר
    expect(all.map((x) => x.score)).toEqual([9, 9, 8, 7, 6, 5, 4, 3, 2, 2])
  })
})
