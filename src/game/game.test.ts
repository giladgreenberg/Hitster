import { describe, expect, it } from 'vitest'
import { gameReducer, newGame, type GameState, type Settings } from './game'
import type { Song } from '../songs/types'

let n = 0
function song(year: number): Song {
  n++
  return {
    id: `t${n}`, uri: `spotify:track:t${n}`, name: `שיר ${n}`, artists: 'אמן', album: 'אלבום',
    coverUrl: null, albumUri: null, durationMs: 200000, isrc: null, spotifyYear: year, year,
    yearSource: 'musicbrainz', mbStatus: '',
  }
}

const settings = (over: Partial<Settings> = {}): Settings => ({
  players: ['דנה', 'יוסי'],
  source: { kind: 'random', fromYear: 1970, toYear: 2020, genres: ['rock'] },
  targetSongs: 3,
  randomStart: false,
  guessBonus: true,
  ...over,
})

const start = (over?: Partial<Settings>) => newGame(settings(over), [song(1980), song(2000)])
const yearsOf = (s: GameState, i = 0) => s.players[i].timeline.map((x) => x.year)

describe('gameReducer', () => {
  it('משחק חדש: לכל שחקן שיר פתיחה אחד, מתחילים במסך העברה', () => {
    const s = start()
    expect(s.players.map((p) => p.timeline.length)).toEqual([1, 1])
    expect(s.phase).toBe('pass')
    expect(s.current).toBe(0)
  })

  it('מיקום נכון מכניס את השיר לציר', () => {
    let s = gameReducer(start(), { type: 'beginTurn', song: song(1990) })
    s = gameReducer(s, { type: 'select', slot: 1 })
    s = gameReducer(s, { type: 'reveal' })
    expect(s.result?.correct).toBe(true)
    expect(yearsOf(s)).toEqual([1980, 1990])
  })

  it('מיקום שגוי זורק את השיר', () => {
    let s = gameReducer(start(), { type: 'beginTurn', song: song(1970) })
    s = gameReducer(s, { type: 'select', slot: 1 })
    s = gameReducer(s, { type: 'reveal' })
    expect(s.result?.correct).toBe(false)
    expect(yearsOf(s)).toEqual([1980])
  })

  it('אי אפשר לחשוף בלי לבחור מקום', () => {
    const s = gameReducer(start(), { type: 'beginTurn', song: song(1990) })
    expect(gameReducer(s, { type: 'reveal' })).toBe(s)
  })

  it('התור עובר לשחקן הבא ומסתובב', () => {
    let s = gameReducer(start(), { type: 'beginTurn', song: song(1990) })
    s = gameReducer(gameReducer(s, { type: 'select', slot: 1 }), { type: 'reveal' })
    s = gameReducer(s, { type: 'next' })
    expect(s.current).toBe(1)
    expect(s.phase).toBe('pass')
    s = gameReducer(s, { type: 'beginTurn', song: song(1990) })
    s = gameReducer(gameReducer(s, { type: 'select', slot: 0 }), { type: 'reveal' })
    s = gameReducer(s, { type: 'next' })
    expect(s.current).toBe(0)
  })

  it('ניחוש נכון נותן אסימון, ורק פעם אחת', () => {
    let s = gameReducer(start(), { type: 'beginTurn', song: song(1990) })
    s = gameReducer(gameReducer(s, { type: 'select', slot: 0 }), { type: 'reveal' })
    s = gameReducer(s, { type: 'guess', correct: true })
    s = gameReducer(s, { type: 'guess', correct: true })
    expect(s.players[0].tokens).toBe(1)
  })

  it('בונוס כבוי – אין אסימונים', () => {
    let s = gameReducer(start({ guessBonus: false }), { type: 'beginTurn', song: song(1990) })
    s = gameReducer(gameReducer(s, { type: 'select', slot: 0 }), { type: 'reveal' })
    s = gameReducer(s, { type: 'guess', correct: true })
    expect(s.players[0].tokens).toBe(0)
  })

  it('דילוג וקנייה עולים 3 אסימונים, ולא אפשריים בלי מספיק', () => {
    let s = gameReducer(start(), { type: 'beginTurn', song: song(1990) })
    expect(gameReducer(s, { type: 'buy' })).toBe(s)
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, tokens: 6 } : p)) }
    s = gameReducer(s, { type: 'skip', song: song(1995) })
    expect(s.players[0].tokens).toBe(3)
    expect(s.song?.year).toBe(1995)
    s = gameReducer(s, { type: 'buy' })
    expect(s.players[0].tokens).toBe(0)
    expect(yearsOf(s)).toEqual([1980, 1995])
    expect(s.phase).toBe('reveal')
  })

  it('"השנה שגויה" מוציא את השיר מהציר ונותן שיר חדש לאותו שחקן', () => {
    let s = gameReducer(start(), { type: 'beginTurn', song: song(1990) })
    s = gameReducer(gameReducer(s, { type: 'select', slot: 1 }), { type: 'reveal' })
    expect(yearsOf(s)).toEqual([1980, 1990])
    s = gameReducer(s, { type: 'wrongYear', song: song(1975) })
    expect(yearsOf(s)).toEqual([1980])
    expect(s.phase).toBe('listen')
    expect(s.current).toBe(0)
    expect(s.song?.year).toBe(1975)
  })

  it('מגיעים ליעד – המשחק נגמר עם מנצח', () => {
    let s = start({ targetSongs: 2 })
    s = gameReducer(s, { type: 'beginTurn', song: song(1990) })
    s = gameReducer(gameReducer(s, { type: 'select', slot: 1 }), { type: 'reveal' })
    expect(s.winner).toBe(0)
    s = gameReducer(s, { type: 'next' })
    expect(s.phase).toBe('over')
  })

  it('סיום מוקדם – המנצח הוא בעל הציר הארוך', () => {
    let s = start()
    s = { ...s, players: s.players.map((p, i) => (i === 1 ? { ...p, timeline: [...p.timeline, song(2010)] } : p)) }
    s = gameReducer(s, { type: 'end' })
    expect(s.phase).toBe('over')
    expect(s.winner).toBe(1)
  })
})
