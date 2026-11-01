import { describe, expect, it } from 'vitest'
import { correctSlots, insertByYear, isPlacementCorrect } from './rules'

describe('isPlacementCorrect', () => {
  it('ציר ריק: המיקום היחיד (0) תמיד נכון', () => {
    expect(isPlacementCorrect([], 0, 1987)).toBe(true)
  })

  it('ציר ריק: חריץ שלא קיים – לא נכון', () => {
    expect(isPlacementCorrect([], 1, 1987)).toBe(false)
    expect(isPlacementCorrect([], -1, 1987)).toBe(false)
  })

  it('מיקום ראשון (לפני השיר הראשון)', () => {
    expect(isPlacementCorrect([1980, 1990], 0, 1975)).toBe(true)
    expect(isPlacementCorrect([1980, 1990], 0, 1985)).toBe(false)
  })

  it('מיקום אחרון (אחרי השיר האחרון)', () => {
    expect(isPlacementCorrect([1980, 1990], 2, 2001)).toBe(true)
    expect(isPlacementCorrect([1980, 1990], 2, 1985)).toBe(false)
  })

  it('מיקום באמצע', () => {
    expect(isPlacementCorrect([1970, 1980, 1990], 2, 1985)).toBe(true)
    expect(isPlacementCorrect([1970, 1980, 1990], 1, 1985)).toBe(false)
    expect(isPlacementCorrect([1970, 1980, 1990], 3, 1985)).toBe(false)
  })

  it('שנה זהה לשכן נחשבת נכונה – משני הצדדים', () => {
    expect(isPlacementCorrect([1980, 1990], 1, 1980)).toBe(true) // זהה לשכן משמאל
    expect(isPlacementCorrect([1980, 1990], 1, 1990)).toBe(true) // זהה לשכן מימין
    expect(isPlacementCorrect([1980, 1990], 0, 1980)).toBe(true) // לפני הראשון, אותה שנה
    expect(isPlacementCorrect([1980, 1990], 2, 1990)).toBe(true) // אחרי האחרון, אותה שנה
  })

  it('כמה שירים מאותה שנה ברצף', () => {
    const years = [1985, 1985, 1985]
    for (let slot = 0; slot <= 3; slot++) expect(isPlacementCorrect(years, slot, 1985)).toBe(true)
    expect(isPlacementCorrect(years, 1, 1986)).toBe(false)
    expect(isPlacementCorrect(years, 3, 1986)).toBe(true)
  })

  it('ציר עם שיר אחד', () => {
    expect(isPlacementCorrect([2000], 0, 1999)).toBe(true)
    expect(isPlacementCorrect([2000], 1, 1999)).toBe(false)
    expect(isPlacementCorrect([2000], 0, 2000)).toBe(true)
    expect(isPlacementCorrect([2000], 1, 2000)).toBe(true)
  })

  it('חריץ לא שלם או מחוץ לטווח', () => {
    expect(isPlacementCorrect([1980], 0.5, 1980)).toBe(false)
    expect(isPlacementCorrect([1980], 2, 1990)).toBe(false)
  })
})

describe('correctSlots / insertByYear', () => {
  it('מחזיר את כל החריצים הנכונים', () => {
    expect(correctSlots([1980, 1990], 1985)).toEqual([1])
    expect(correctSlots([1980, 1990], 1990)).toEqual([1, 2])
    expect(correctSlots([], 2000)).toEqual([0])
  })

  it('מכניס במקום הנכון ושומר על מיון', () => {
    const t = [{ year: 1970 }, { year: 1990 }]
    expect(insertByYear(t, { year: 1980 }).map((x) => x.year)).toEqual([1970, 1980, 1990])
    expect(insertByYear(t, { year: 1960 }).map((x) => x.year)).toEqual([1960, 1970, 1990])
    expect(insertByYear(t, { year: 2000 }).map((x) => x.year)).toEqual([1970, 1990, 2000])
    expect(insertByYear([], { year: 2000 }).map((x) => x.year)).toEqual([2000])
  })
})
