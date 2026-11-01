import { describe, expect, it } from 'vitest'
import { newSoloGame, soloReducer, timeLeftMs, type SoloState } from './solo'
import type { Settings } from './game'
import type { Song } from '../songs/types'

let n = 0
const song = (year: number): Song => {
  n++
  return { id: `s${n}`, uri: `spotify:track:s${n}`, name: `שיר ${n}`, artists: 'א', album: 'x', coverUrl: null, albumUri: null, durationMs: 1, isrc: null, spotifyYear: year, year, yearSource: 'musicbrainz', mbStatus: '' }
}
const settings: Settings = {
  mode: 'solo', players: ['דנה'], source: { kind: 'random', fromYear: 1970, toYear: 2020, genres: ['rock'] },
  targetSongs: 10, randomStart: false, guessBonus: false, soloSeconds: 30,
}
const T0 = 1_000_000

/** מתחיל תור: שיר חדש, השעון מתחיל ב-T0, ומיקום בחריץ slot */
function turn(s: SoloState, year: number, slot: number): SoloState {
  s = soloReducer(s, { type: 'beginTurn', song: song(year) })
  s = soloReducer(s, { type: 'timerStart', at: T0 })
  return soloReducer(s, { type: 'select', slot })
}

describe('מצב סולו', () => {
  it('מיקום נכון: נקודה, השיר נכנס, והמשחק ממשיך', () => {
    let s = turn(newSoloGame(settings, song(1980)), 1990, 1)
    s = soloReducer(s, { type: 'reveal', at: T0 + 5000 })
    expect(s.result).toMatchObject({ correct: true, gameOver: false, points: 1 })
    expect(s.score).toBe(1)
    expect(s.timeline.map((x) => x.year)).toEqual([1980, 1990])
    s = turn(s, 2000, 2)
    s = soloReducer(s, { type: 'reveal', at: T0 + 1000 })
    expect(s.score).toBe(2)
    expect(s.turn).toBe(2)
  })

  it('הטעות הראשונה מסיימת את המשחק', () => {
    let s = turn(newSoloGame(settings, song(1980)), 1970, 1)
    s = soloReducer(s, { type: 'reveal', at: T0 + 5000 })
    expect(s.result).toMatchObject({ correct: false, gameOver: true })
    expect(s.score).toBe(0)
    // אי אפשר להתחיל תור חדש אחרי טעות
    expect(soloReducer(s, { type: 'beginTurn', song: song(1990) })).toBe(s)
    s = soloReducer(s, { type: 'finish' })
    expect(s.phase).toBe('over')
  })

  it('נגמר הזמן = טעות, גם בלי שבחרו מקום', () => {
    let s = soloReducer(newSoloGame(settings, song(1980)), { type: 'beginTurn', song: song(1990) })
    s = soloReducer(s, { type: 'timerStart', at: T0 })
    s = soloReducer(s, { type: 'timeout', at: T0 + 30_000 })
    expect(s.result).toMatchObject({ correct: false, timeout: true, gameOver: true })
    expect(s.events.at(-1)?.how).toBe('timeout')
  })

  it('חשיפה אחרי שהזמן נגמר נחשבת טעות בתום הזמן (גם אם המיקום נכון)', () => {
    let s = turn(newSoloGame(settings, song(1980)), 1990, 1)
    s = soloReducer(s, { type: 'reveal', at: T0 + 30_001 })
    expect(s.result).toMatchObject({ correct: false, timeout: true, gameOver: true })
    expect(s.score).toBe(0)
  })

  it('חשיפה ממש לפני סוף הזמן – נחשבת', () => {
    let s = turn(newSoloGame(settings, song(1980)), 1990, 1)
    s = soloReducer(s, { type: 'reveal', at: T0 + 29_999 })
    expect(s.result?.correct).toBe(true)
  })

  it('השעון לא מתחיל עד שהשיר מתחיל להתנגן', () => {
    let s = soloReducer(newSoloGame(settings, song(1980)), { type: 'beginTurn', song: song(1990) })
    expect(timeLeftMs(s, T0)).toBe(null)
    s = soloReducer(s, { type: 'timerStart', at: T0 })
    expect(timeLeftMs(s, T0 + 10_000)).toBe(20_000)
    // timerStart שני לא מאפס את השעון
    s = soloReducer(s, { type: 'timerStart', at: T0 + 10_000 })
    expect(timeLeftMs(s, T0 + 10_000)).toBe(20_000)
  })

  it('שנה מדויקת עם מיקום נכון = 2 נקודות; שנה מדויקת עם מיקום שגוי = 0', () => {
    let s = turn(newSoloGame(settings, song(1980)), 1990, 1)
    s = soloReducer(s, { type: 'reveal', at: T0 + 1000, exactGuess: 1990 })
    expect(s.result).toMatchObject({ exactHit: true, points: 2 })
    expect(s.score).toBe(2)

    let w = turn(newSoloGame(settings, song(1980)), 1990, 0)
    w = soloReducer(w, { type: 'reveal', at: T0 + 1000, exactGuess: 1990 })
    expect(w.result).toMatchObject({ correct: false, exactHit: false, points: 0, gameOver: true })
  })

  it('"השנה שגויה" מבטל את התור ומחזיר את הניקוד', () => {
    let s = turn(newSoloGame(settings, song(1980)), 1990, 1)
    s = soloReducer(s, { type: 'reveal', at: T0 + 1000, exactGuess: 1990 })
    s = soloReducer(s, { type: 'wrongYear', song: song(1975) })
    expect(s.score).toBe(0)
    expect(s.timeline.map((x) => x.year)).toEqual([1980])
    expect(s.phase).toBe('listen')
    expect(s.events).toHaveLength(0)
  })

  it('כל מיקום נרשם ביומן האירועים עם הזמן שלקח', () => {
    let s = turn(newSoloGame(settings, song(1980)), 1990, 1)
    s = soloReducer(s, { type: 'reveal', at: T0 + 7000 })
    expect(s.events[0]).toMatchObject({ actor: 'דנה', year: 1990, before: 1980, after: null, correct: true, durationMs: 7000, timelineSize: 1 })
  })
})
