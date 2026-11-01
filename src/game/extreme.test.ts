import { describe, expect, it } from 'vitest'
import { extremeReducer, newExtremeGame, type ExtremeState } from './extreme'
import type { Settings } from './game'
import type { Song } from '../songs/types'

let n = 0
const song = (year: number): Song => {
  n++
  return { id: `e${n}`, uri: `spotify:track:e${n}`, name: `שיר ${n}`, artists: 'א', album: 'x', coverUrl: null, albumUri: null, durationMs: 1, isrc: null, spotifyYear: year, year, yearSource: 'musicbrainz', mbStatus: '' }
}
const settings: Settings = {
  mode: 'extreme', players: [], teams: ['הכחולים', 'האדומים'], source: { kind: 'random', fromYear: 1970, toYear: 2020, genres: ['rock'] },
  targetSongs: 10, randomStart: false, guessBonus: false,
}
const start = () => newExtremeGame(settings, song(1980))

/** תור שלם: שיר, מיקום, חשיפה */
function play(s: ExtremeState, year: number, slot: number, exactGuess?: number): ExtremeState {
  s = extremeReducer(s, { type: 'beginTurn', song: song(year) })
  s = extremeReducer(s, { type: 'select', slot })
  return extremeReducer(s, { type: 'reveal', exactGuess })
}
/** תור שגוי מכוון: שנה מוקדמת מהכול ומיקום בסוף */
const miss = (s: ExtremeState) => extremeReducer(play(s, 1900, s.timeline.length), { type: 'next' })
/** תור נכון: שנה מאוחרת מהכול ומיקום בסוף */
const hit = (s: ExtremeState) => extremeReducer(play(s, 2025, s.timeline.length), { type: 'next' })

describe('מצב אקסטרים', () => {
  it('מתחילים עם ציר משותף אחד ו-3 לבבות לכל קבוצה', () => {
    const s = start()
    expect(s.timeline).toHaveLength(1)
    expect(s.teams.map((t) => t.lives)).toEqual([3, 3])
    expect(s.teams.map((t) => t.name)).toEqual(['הכחולים', 'האדומים'])
  })

  it('שתי הקבוצות ממקמות באותו ציר, ומתחלפות בתורות', () => {
    let s = play(start(), 1990, 1)
    expect(s.result?.correct).toBe(true)
    s = extremeReducer(s, { type: 'next' })
    expect(s.current).toBe(1)
    s = play(s, 1970, 0)
    expect(s.timeline.map((x) => x.year)).toEqual([1970, 1980, 1990])
    expect(s.teams.map((t) => t.correct)).toEqual([1, 1])
  })

  it('טעות מורידה לב אחד והשיר נזרק', () => {
    const s = play(start(), 1970, 1)
    expect(s.result).toMatchObject({ correct: false, lifeLost: true, eliminated: false })
    expect(s.teams[0].lives).toBe(2)
    expect(s.teams[1].lives).toBe(3)
    expect(s.timeline).toHaveLength(1)
  })

  it('3 טעויות = פסילה, והקבוצה השנייה מנצחת', () => {
    let s = start()
    s = miss(s) // קבוצה 0: 2 לבבות
    s = hit(s) // קבוצה 1
    s = miss(s) // קבוצה 0: לב 1
    s = hit(s) // קבוצה 1
    s = play(s, 1900, s.timeline.length) // קבוצה 0: 0 לבבות
    expect(s.result?.eliminated).toBe(true)
    expect(s.teams[0].lives).toBe(0)
    expect(s.winner).toBe(1)
    s = extremeReducer(s, { type: 'next' })
    expect(s.phase).toBe('over')
  })

  it('לבבות לא יורדים מתחת ל-0', () => {
    let s = start()
    for (let i = 0; i < 3; i++) s = hit(miss(s))
    expect(s.teams[0].lives).toBe(0)
    expect(s.teams.every((t) => t.lives >= 0)).toBe(true)
  })

  it('קליעה לשנה מדויקת (עם מיקום נכון) מחזירה לב שאבד', () => {
    let s = miss(start()) // קבוצה 0 עם 2 לבבות
    s = hit(s)
    s = play(s, 2026, s.timeline.length, 2026)
    expect(s.result).toMatchObject({ correct: true, exactHit: true, lifeRestored: true })
    expect(s.teams[0].lives).toBe(3)
  })

  it('שנה מדויקת עם לבבות מלאים – לא עוברים את 3', () => {
    const s = play(start(), 1990, 1, 1990)
    expect(s.result).toMatchObject({ exactHit: true, lifeRestored: false })
    expect(s.teams[0].lives).toBe(3)
  })

  it('שנה מדויקת עם מיקום שגוי – אין בונוס, ומאבדים לב', () => {
    const s = play(start(), 1990, 0, 1990)
    expect(s.result).toMatchObject({ correct: false, exactHit: false, lifeRestored: false })
    expect(s.teams[0].lives).toBe(2)
  })

  it('"השנה שגויה" מחזיר את הלב שאבד ומבטל את הפסילה', () => {
    let s = start()
    s = hit(miss(s))
    s = hit(miss(s))
    s = play(s, 1900, s.timeline.length)
    expect(s.winner).toBe(1)
    s = extremeReducer(s, { type: 'wrongYear', song: song(1985) })
    expect(s.teams[0].lives).toBe(1)
    expect(s.winner).toBe(null)
    expect(s.phase).toBe('listen')
    expect(s.current).toBe(0)
  })

  it('סיום מוקדם: מנצחת הקבוצה עם יותר לבבות', () => {
    const s = extremeReducer(miss(start()), { type: 'end' })
    expect(s.phase).toBe('over')
    expect(s.winner).toBe(1)
  })

  it('כל תור נרשם ביומן עם שם הקבוצה', () => {
    let s = play(start(), 1990, 1)
    s = extremeReducer(s, { type: 'next' })
    s = play(s, 1970, 2)
    expect(s.events.map((e) => [e.actor, e.correct])).toEqual([
      ['הכחולים', true],
      ['האדומים', false],
    ])
  })
})
