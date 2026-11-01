// מצב המשחק והפעולות עליו (reducer). בלי React ובלי רשת – כדי שיהיה קל לבדוק.
//
// אסימונים (לפי חוקי היטסטר המקוריים):
// - כל שחקן מתחיל עם 2, ואפשר להחזיק עד 5.
// - ניחוש נכון של שם השיר והאמן = +1.
// - דילוג על שיר = 1. אתגר ("היטסטר!") = 1. קניית שיר = 3.
// - אתגר: אחרי שהשחקן שבתור מיקם, שחקן אחר (אחד בלבד בכל תור) יכול לשים אסימון על מקום אחר
//   באותו ציר. אם השחקן שבתור טעה והמאתגר צדק – השיר עובר לציר של המאתגר.
import type { Song } from '../songs/types'
import type { SourceConfig } from '../songs/sources'
import { isPlacementCorrect } from './rules'

export const START_TOKENS = 2
export const MAX_TOKENS = 5
export const SKIP_COST = 1
export const CHALLENGE_COST = 1
export const BUY_COST = 3

export interface Settings {
  players: string[]
  source: SourceConfig
  targetSongs: number
  randomStart: boolean
  /** האם משחקים עם אסימונים (ניחוש, דילוג, אתגר, קנייה) */
  guessBonus: boolean
}

export interface Player {
  name: string
  timeline: Song[] // ממוין לפי שנה
  tokens: number
}

/**
 * pass = מסך העברת טלפון, listen = האזנה ומיקום, challenge = הזדמנות לאתגר,
 * reveal = חשיפה, over = סוף
 */
export type Phase = 'pass' | 'listen' | 'challenge' | 'reveal' | 'over'

export interface Challenge {
  player: number
  slot: number | null
}

export interface TurnResult {
  how: 'placed' | 'bought'
  correct: boolean
  /** האם השחקן ניחש נכון שם+אמן (null = עוד לא נשפט / אסימונים כבויים) */
  guessed: boolean | null
  /** תוצאת האתגר, אם היה */
  challenge: { player: number; correct: boolean; wonCard: boolean } | null
}

export interface GameState {
  settings: Settings
  players: Player[]
  current: number
  phase: Phase
  song: Song | null
  slot: number | null
  challenge: Challenge | null
  result: TurnResult | null
  usedIds: string[]
  winner: number | null
  turn: number
}

export type Action =
  | { type: 'beginTurn'; song: Song }
  | { type: 'select'; slot: number }
  | { type: 'lockIn' }
  | { type: 'challenger'; player: number | null }
  | { type: 'challengeSlot'; slot: number }
  | { type: 'reveal' }
  | { type: 'guess'; correct: boolean }
  | { type: 'skip'; song: Song }
  | { type: 'buy' }
  | { type: 'wrongYear'; song: Song }
  | { type: 'next' }
  | { type: 'end' }

export function newGame(settings: Settings, starters: Song[]): GameState {
  const tokens = settings.guessBonus ? START_TOKENS : 0
  return {
    settings,
    players: settings.players.map((name, i) => ({ name, timeline: [starters[i]], tokens })),
    current: 0,
    phase: 'pass',
    song: null,
    slot: null,
    challenge: null,
    result: null,
    usedIds: starters.map((s) => s.id),
    winner: null,
    turn: 1,
  }
}

const yearsOf = (p: Player) => p.timeline.map((s) => s.year)

function mapPlayer(players: Player[], index: number, fn: (p: Player) => Player): Player[] {
  return players.map((p, i) => (i === index ? fn(p) : p))
}

function insertAt<T>(arr: T[], index: number, item: T): T[] {
  return [...arr.slice(0, index), item, ...arr.slice(index)]
}

/** המקום הנכון הראשון לשיר בציר */
export function autoSlot(p: Player, year: number): number {
  const ys = yearsOf(p)
  for (let i = 0; i <= ys.length; i++) if (isPlacementCorrect(ys, i, year)) return i
  return ys.length
}

const addTokens = (p: Player, n: number): Player => ({ ...p, tokens: Math.max(0, Math.min(MAX_TOKENS, p.tokens + n)) })

/** מי יכול לאתגר עכשיו: שחקנים אחרים עם מספיק אסימונים */
export function eligibleChallengers(state: GameState): number[] {
  if (!state.settings.guessBonus) return []
  return state.players.map((p, i) => ({ p, i })).filter(({ p, i }) => i !== state.current && p.tokens >= CHALLENGE_COST).map(({ i }) => i)
}

/** מנצח: השחקן שבתור קודם, ואז המאתגר */
function checkWinner(state: GameState): number | null {
  const target = state.settings.targetSongs
  if (state.players[state.current].timeline.length >= target) return state.current
  const ch = state.result?.challenge
  if (ch && state.players[ch.player].timeline.length >= target) return ch.player
  return null
}

export function gameReducer(state: GameState, action: Action): GameState {
  const player = state.players[state.current]
  const tokensOn = state.settings.guessBonus

  switch (action.type) {
    case 'beginTurn':
      if (state.phase !== 'pass') return state
      return {
        ...state,
        phase: 'listen',
        song: action.song,
        slot: null,
        challenge: null,
        result: null,
        usedIds: [...state.usedIds, action.song.id],
      }

    case 'select':
      if (state.phase !== 'listen') return state
      if (action.slot < 0 || action.slot > player.timeline.length) return state
      return { ...state, slot: action.slot }

    case 'lockIn':
      // השחקן שבתור סיים למקם – הזדמנות לאתגר (רק אם יש מי שיכול)
      if (state.phase !== 'listen' || state.slot === null) return state
      if (eligibleChallengers(state).length === 0) return state
      return { ...state, phase: 'challenge', challenge: null }

    case 'challenger':
      if (state.phase !== 'challenge') return state
      if (action.player === null) return { ...state, challenge: null }
      if (!eligibleChallengers(state).includes(action.player)) return state
      return { ...state, challenge: { player: action.player, slot: null } }

    case 'challengeSlot':
      if (state.phase !== 'challenge' || !state.challenge) return state
      if (action.slot === state.slot || action.slot < 0 || action.slot > player.timeline.length) return state
      return { ...state, challenge: { ...state.challenge, slot: action.slot } }

    case 'reveal': {
      if ((state.phase !== 'listen' && state.phase !== 'challenge') || !state.song || state.slot === null) return state
      const song = state.song
      const slot = state.slot
      const ys = yearsOf(player)
      const correct = isPlacementCorrect(ys, slot, song.year)
      let players = correct ? mapPlayer(state.players, state.current, (p) => ({ ...p, timeline: insertAt(p.timeline, slot, song) })) : state.players

      // אתגר (רק אם המאתגר באמת בחר מקום)
      let challenge: TurnResult['challenge'] = null
      const ch = state.phase === 'challenge' ? state.challenge : null
      if (ch && ch.slot !== null) {
        const chCorrect = isPlacementCorrect(ys, ch.slot, song.year)
        const wonCard = !correct && chCorrect
        players = mapPlayer(players, ch.player, (p) => {
          const paid = addTokens(p, -CHALLENGE_COST)
          return wonCard ? { ...paid, timeline: insertAt(paid.timeline, autoSlot(paid, song.year), song) } : paid
        })
        challenge = { player: ch.player, correct: chCorrect, wonCard }
      }

      const next: GameState = {
        ...state,
        phase: 'reveal',
        players,
        result: { how: 'placed', correct, guessed: tokensOn ? null : false, challenge },
      }
      return { ...next, winner: checkWinner(next) }
    }

    case 'guess': {
      if (state.phase !== 'reveal' || !state.result || state.result.guessed !== null || !tokensOn) return state
      return {
        ...state,
        players: action.correct ? mapPlayer(state.players, state.current, (p) => addTokens(p, 1)) : state.players,
        result: { ...state.result, guessed: action.correct },
      }
    }

    case 'skip':
      // משלמים אסימון ומקבלים שיר אחר באותו תור
      if (state.phase !== 'listen' || !tokensOn || player.tokens < SKIP_COST) return state
      return {
        ...state,
        players: mapPlayer(state.players, state.current, (p) => addTokens(p, -SKIP_COST)),
        song: action.song,
        slot: null,
        usedIds: [...state.usedIds, action.song.id],
      }

    case 'buy': {
      // משלמים 3 אסימונים והשיר נכנס לציר אוטומטית במקום הנכון
      if (state.phase !== 'listen' || !state.song || !tokensOn || player.tokens < BUY_COST) return state
      const song = state.song
      const next: GameState = {
        ...state,
        phase: 'reveal',
        slot: autoSlot(player, song.year),
        challenge: null,
        players: mapPlayer(state.players, state.current, (p) => {
          const paid = addTokens(p, -BUY_COST)
          return { ...paid, timeline: insertAt(paid.timeline, autoSlot(paid, song.year), song) }
        }),
        result: { how: 'bought', correct: true, guessed: null, challenge: null },
      }
      return { ...next, winner: checkWinner(next) }
    }

    case 'wrongYear': {
      // "השנה שגויה": מבטלים את התור בלי עונש – השיר יוצא מכל ציר שאליו נכנס,
      // אסימונים ששולמו (קנייה/אתגר) מוחזרים, ואותו שחקן מקבל שיר חדש.
      if (state.phase !== 'reveal' || !state.song) return state
      const bad = state.song
      const r = state.result
      let players = mapPlayer(state.players, state.current, (p) => ({
        ...p,
        tokens: Math.min(MAX_TOKENS, p.tokens + (r?.how === 'bought' ? BUY_COST : 0)),
        timeline: p.timeline.filter((s) => s.id !== bad.id),
      }))
      if (r?.challenge) {
        players = mapPlayer(players, r.challenge.player, (p) => ({
          ...p,
          tokens: Math.min(MAX_TOKENS, p.tokens + CHALLENGE_COST),
          timeline: p.timeline.filter((s) => s.id !== bad.id),
        }))
      }
      return {
        ...state,
        phase: 'listen',
        players,
        song: action.song,
        slot: null,
        challenge: null,
        result: null,
        winner: null,
        usedIds: [...state.usedIds, action.song.id],
      }
    }

    case 'next':
      if (state.phase !== 'reveal') return state
      if (state.winner !== null) return { ...state, phase: 'over' }
      return {
        ...state,
        phase: 'pass',
        current: (state.current + 1) % state.players.length,
        song: null,
        slot: null,
        challenge: null,
        result: null,
        turn: state.turn + 1,
      }

    case 'end': {
      // סיום מוקדם (למשל נגמרו השירים): המנצח הוא מי שיש לו הכי הרבה שירים
      let best = 0
      state.players.forEach((p, i) => {
        if (p.timeline.length > state.players[best].timeline.length) best = i
      })
      return { ...state, phase: 'over', winner: best }
    }
  }
}
