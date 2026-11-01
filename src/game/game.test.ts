import { describe, expect, it } from 'vitest'
import { eligibleChallengers, gameReducer, newGame, MAX_TOKENS, type GameState, type Settings } from './game'
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
const withTokens = (s: GameState, i: number, tokens: number): GameState => ({
  ...s,
  players: s.players.map((p, j) => (j === i ? { ...p, tokens } : p)),
})
/** דנה (0) בתור עם ציר [1980], יוסי (1) מאתגר */
function challengeTurn(year: number, activeSlot: number, challengerSlot: number) {
  let s = gameReducer(start(), { type: 'beginTurn', song: song(year) })
  s = gameReducer(s, { type: 'select', slot: activeSlot })
  s = gameReducer(s, { type: 'lockIn' })
  s = gameReducer(s, { type: 'challenger', player: 1 })
  s = gameReducer(s, { type: 'challengeSlot', slot: challengerSlot })
  return gameReducer(s, { type: 'reveal' })
}

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

  it('כל שחקן מתחיל עם 2 אסימונים (ו-0 כשהאסימונים כבויים)', () => {
    expect(start().players.map((p) => p.tokens)).toEqual([2, 2])
    expect(start({ guessBonus: false }).players.map((p) => p.tokens)).toEqual([0, 0])
  })

  it('ניחוש נכון נותן אסימון, רק פעם אחת, ועד 5 לכל היותר', () => {
    let s = gameReducer(start(), { type: 'beginTurn', song: song(1990) })
    s = gameReducer(gameReducer(s, { type: 'select', slot: 0 }), { type: 'reveal' })
    s = gameReducer(s, { type: 'guess', correct: true })
    s = gameReducer(s, { type: 'guess', correct: true })
    expect(s.players[0].tokens).toBe(3)

    let full = withTokens(start(), 0, MAX_TOKENS)
    full = gameReducer(full, { type: 'beginTurn', song: song(1990) })
    full = gameReducer(gameReducer(full, { type: 'select', slot: 0 }), { type: 'reveal' })
    full = gameReducer(full, { type: 'guess', correct: true })
    expect(full.players[0].tokens).toBe(MAX_TOKENS)
  })

  it('אסימונים כבויים – אין ניחוש, דילוג, קנייה או אתגר', () => {
    let s = gameReducer(start({ guessBonus: false }), { type: 'beginTurn', song: song(1990) })
    expect(gameReducer(s, { type: 'skip', song: song(1991) })).toBe(s)
    s = gameReducer(s, { type: 'select', slot: 0 })
    expect(gameReducer(s, { type: 'lockIn' })).toBe(s)
    s = gameReducer(s, { type: 'reveal' })
    s = gameReducer(s, { type: 'guess', correct: true })
    expect(s.players[0].tokens).toBe(0)
  })

  it('דילוג עולה אסימון 1, קנייה עולה 3, ולא אפשריים בלי מספיק', () => {
    let s = gameReducer(start(), { type: 'beginTurn', song: song(1990) })
    expect(gameReducer(s, { type: 'buy' })).toBe(s) // יש רק 2
    s = gameReducer(s, { type: 'skip', song: song(1995) })
    expect(s.players[0].tokens).toBe(1)
    expect(s.song?.year).toBe(1995)
    s = withTokens(s, 0, 3)
    s = gameReducer(s, { type: 'buy' })
    expect(s.players[0].tokens).toBe(0)
    expect(yearsOf(s)).toEqual([1980, 1995])
    expect(s.phase).toBe('reveal')
    const broke = gameReducer(withTokens(start(), 0, 0), { type: 'beginTurn', song: song(1990) })
    expect(gameReducer(broke, { type: 'skip', song: song(1991) })).toBe(broke)
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

  describe('אתגר ("היטסטר!")', () => {
    it('השחקן שבתור טעה והמאתגר צדק – השיר עובר לציר של המאתגר', () => {
      const s = challengeTurn(1970, 1, 0) // 1970 צריך לבוא לפני 1980
      expect(s.result?.correct).toBe(false)
      expect(s.result?.challenge).toEqual({ player: 1, correct: true, wonCard: true })
      expect(yearsOf(s, 0)).toEqual([1980])
      expect(yearsOf(s, 1)).toEqual([1970, 2000]) // נכנס במקום הנכון בציר של המאתגר
      expect(s.players[1].tokens).toBe(1)
    })

    it('השחקן שבתור צדק – המאתגר מפסיד את האסימון', () => {
      const s = challengeTurn(1990, 1, 0)
      expect(s.result?.correct).toBe(true)
      expect(s.result?.challenge?.wonCard).toBe(false)
      expect(yearsOf(s, 0)).toEqual([1980, 1990])
      expect(yearsOf(s, 1)).toEqual([2000])
      expect(s.players[1].tokens).toBe(1)
    })

    it('שניהם טעו – השיר נזרק והמאתגר מפסיד אסימון', () => {
      let s = gameReducer(start(), { type: 'beginTurn', song: song(1970) })
      s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, timeline: [song(1960), song(1980)] } : p)) }
      s = gameReducer(s, { type: 'select', slot: 0 }) // לפני 1960 – טעות
      s = gameReducer(s, { type: 'lockIn' })
      s = gameReducer(s, { type: 'challenger', player: 1 })
      s = gameReducer(s, { type: 'challengeSlot', slot: 2 }) // אחרי 1980 – טעות
      s = gameReducer(s, { type: 'reveal' })
      expect(s.result?.challenge).toEqual({ player: 1, correct: false, wonCard: false })
      expect(yearsOf(s, 0)).toEqual([1960, 1980])
      expect(yearsOf(s, 1)).toEqual([2000])
      expect(s.players[1].tokens).toBe(1)
    })

    it('המאתגר לא יכול לבחור את אותו מקום כמו השחקן שבתור', () => {
      let s = gameReducer(start(), { type: 'beginTurn', song: song(1990) })
      s = gameReducer(s, { type: 'select', slot: 1 })
      s = gameReducer(s, { type: 'lockIn' })
      s = gameReducer(s, { type: 'challenger', player: 1 })
      expect(gameReducer(s, { type: 'challengeSlot', slot: 1 })).toBe(s)
    })

    it('רק שחקנים אחרים עם אסימון יכולים לאתגר; בלי מאתגרים אין שלב אתגר', () => {
      let s = gameReducer(start(), { type: 'beginTurn', song: song(1990) })
      expect(eligibleChallengers(s)).toEqual([1])
      s = withTokens(s, 1, 0)
      expect(eligibleChallengers(s)).toEqual([])
      s = gameReducer(s, { type: 'select', slot: 1 })
      expect(gameReducer(s, { type: 'lockIn' })).toBe(s)
      expect(gameReducer(s, { type: 'challenger', player: 0 })).toBe(s)
    })

    it('ויתור על אתגר – אף אחד לא משלם', () => {
      let s = gameReducer(start(), { type: 'beginTurn', song: song(1990) })
      s = gameReducer(gameReducer(s, { type: 'select', slot: 1 }), { type: 'lockIn' })
      s = gameReducer(s, { type: 'reveal' })
      expect(s.result?.challenge).toBe(null)
      expect(s.players.map((p) => p.tokens)).toEqual([2, 2])
    })

    it('המאתגר יכול לנצח במשחק עם השיר שזכה בו', () => {
      let s = gameReducer(start({ targetSongs: 2 }), { type: 'beginTurn', song: song(1970) })
      s = gameReducer(s, { type: 'select', slot: 1 })
      s = gameReducer(s, { type: 'lockIn' })
      s = gameReducer(s, { type: 'challenger', player: 1 })
      s = gameReducer(s, { type: 'challengeSlot', slot: 0 })
      s = gameReducer(s, { type: 'reveal' })
      expect(s.winner).toBe(1)
    })

    it('"השנה שגויה" אחרי אתגר – מחזיר את האסימון ומוציא את השיר מציר המאתגר', () => {
      let s = challengeTurn(1970, 1, 0)
      s = gameReducer(s, { type: 'wrongYear', song: song(1985) })
      expect(yearsOf(s, 1)).toEqual([2000])
      expect(s.players[1].tokens).toBe(2)
    })
  })

  it('אסימונים אף פעם לא יורדים מתחת ל-0', () => {
    let s = withTokens(start(), 0, 0)
    s = withTokens(s, 1, 0)
    s = gameReducer(s, { type: 'beginTurn', song: song(1990) })
    // בלי אסימונים: דילוג וקנייה חסומים, ואין מי שיאתגר
    expect(gameReducer(s, { type: 'skip', song: song(1991) })).toBe(s)
    expect(gameReducer(s, { type: 'buy' })).toBe(s)
    s = gameReducer(s, { type: 'select', slot: 1 })
    expect(gameReducer(s, { type: 'lockIn' })).toBe(s)
    // גם אם מגיעים איכשהו לאתגר עם 0 – לא יורדים למינוס
    const forced: GameState = { ...s, phase: 'challenge', challenge: { player: 1, slot: 0 } }
    const after = gameReducer(forced, { type: 'reveal' })
    expect(after.players.every((p) => p.tokens >= 0)).toBe(true)
    // רצף פעולות אקראי ארוך – אף פעם לא שלילי
    let g = start()
    for (let i = 0; i < 300; i++) {
      const actions = [
        { type: 'beginTurn', song: song(1950 + (i % 70)) },
        { type: 'select', slot: i % 3 },
        { type: 'lockIn' },
        { type: 'challenger', player: i % 2 },
        { type: 'challengeSlot', slot: (i + 1) % 3 },
        { type: 'skip', song: song(1960 + (i % 50)) },
        { type: 'buy' },
        { type: 'reveal' },
        { type: 'guess', correct: i % 2 === 0 },
        { type: 'next' },
      ] as const
      g = gameReducer(g, actions[i % actions.length] as never)
      if (g.phase === 'over') g = start()
      expect(g.players.every((p) => p.tokens >= 0 && p.tokens <= MAX_TOKENS)).toBe(true)
    }
  })
})
