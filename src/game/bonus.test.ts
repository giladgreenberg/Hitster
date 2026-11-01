import { describe, expect, it } from 'vitest'
import { exactYearHit, parseYearGuess } from './bonus'

describe('בונוס שנה מדויקת', () => {
  it('קליעה רק לשנה זהה בדיוק', () => {
    expect(exactYearHit(1987, 1987)).toBe(true)
    expect(exactYearHit(1986, 1987)).toBe(false)
    expect(exactYearHit(null, 1987)).toBe(false)
    expect(exactYearHit(undefined, 1987)).toBe(false)
  })
  it('קריאת הקלט מהשדה', () => {
    expect(parseYearGuess(' 1987 ')).toBe(1987)
    expect(parseYearGuess('87')).toBe(null)
    expect(parseYearGuess('19877')).toBe(null)
    expect(parseYearGuess('abcd')).toBe(null)
    expect(parseYearGuess('1850')).toBe(null)
    expect(parseYearGuess('')).toBe(null)
  })
})
