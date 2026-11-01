// מצב המשחק והפעולות עליו (reducer). בלי React ובלי רשת – כדי שיהיה קל לבדוק.
import type { Song } from '../songs/types'
import type { SourceConfig } from '../songs/sources'
import { isPlacementCorrect } from './rules'

export const TOKEN_COST = 3

export interface Settings {
  players: string[]
  source: SourceConfig
  targetSongs: number
  randomStart: boolean
  guessBonus: boolean
}

export interface Player {
  name: string
  timeline: Song[] // ממוין לפי שנה
  tokens: number
}

export type Phase = 'pass' | 'listen' | 'reveal' | 'over'

export interface TurnResult {
  how: 'placed' | 'bought'
  correct: boolean
  /** האם השחקן ניחש נכון שם+אמן (null = עוד לא נשפט / בונוס כבוי) */
  guessed: boolean | null
}

export interface GameState {
  settings: Settings
  players: Player[]
  current: number
  phase: Phase
  song: Song | null
  slot: number | null
  result: TurnResult | null
  usedIds: string[]
  winner: number | null
  turn: number
}

export type Action =
  | { type: 'select'; slot: number }
  | { type: 'beginTurn'; song: Song }
  | { type: 'reveal' }
  | { type: 'guess'; correct: boolean }
  | { type: 'skip'; song: Song }
  | { type: 'buy' }
  | { type: 'wrongYear'; song: Song }
  | { type: 'next' }
  | { type: 'end' }

export function newGame(settings: Settings, starters: Song[]): GameState {
  return {
    settings,
    players: settings.players.map((name, i) => ({ name, timeline: [starters[i]], tokens: 0 })),
    current: 0,
    phase: 'pass',
    song: null,
    slot: null,
    result: null,
    usedIds: starters.map((s) => s.id),
    winner: null,
    turn: 1,
  }
}

const years = (p: Player) => p.timeline.map((s) => s.year)

function updatePlayer(state: GameState, fn: (p: Player) => Player): Player[] {
  return state.players.map((p, i) => (i === state.current ? fn(p) : p))
}

function insertAt<T>(arr: T[], index: number, item: T): T[] {
  return [...arr.slice(0, index), item, ...arr.slice(index)]
}

/** המקום הנכון הראשון לשיר בציר */
function autoSlot(p: Player, year: number): number {
  const ys = years(p)
  for (let i = 0; i <= ys.length; i++) if (isPlacementCorrect(ys, i, year)) return i
  return ys.length
}

/** מי הגיע ליעד? (בודקים רק את השחקן הנוכחי – הראשון שמגיע מנצח) */
function checkWinner(state: GameState): number | null {
  const p = state.players[state.current]
  return p.timeline.length >= state.settings.targetSongs ? state.current : null
}

export function gameReducer(state: GameState, action: Action): GameState {
  const player = state.players[state.current]

  switch (action.type) {
    case 'beginTurn':
      if (state.phase !== 'pass') return state
      return {
        ...state,
        phase: 'listen',
        song: action.song,
        slot: null,
        result: null,
        usedIds: [...state.usedIds, action.song.id],
      }

    case 'select':
      if (state.phase !== 'listen') return state
      if (action.slot < 0 || action.slot > player.timeline.length) return state
      return { ...state, slot: action.slot }

    case 'reveal': {
      if (state.phase !== 'listen' || !state.song || state.slot === null) return state
      const correct = isPlacementCorrect(years(player), state.slot, state.song.year)
      const song = state.song
      const slot = state.slot
      const next: GameState = {
        ...state,
        phase: 'reveal',
        players: correct ? updatePlayer(state, (p) => ({ ...p, timeline: insertAt(p.timeline, slot, song) })) : state.players,
        result: { how: 'placed', correct, guessed: null },
      }
      return { ...next, winner: checkWinner(next) }
    }

    case 'guess': {
      if (state.phase !== 'reveal' || !state.result || state.result.guessed !== null) return state
      if (!state.settings.guessBonus) return state
      return {
        ...state,
        players: action.correct ? updatePlayer(state, (p) => ({ ...p, tokens: p.tokens + 1 })) : state.players,
        result: { ...state.result, guessed: action.correct },
      }
    }

    case 'skip':
      // משלמים 3 אסימונים ומקבלים שיר אחר באותו תור
      if (state.phase !== 'listen' || player.tokens < TOKEN_COST) return state
      return {
        ...state,
        players: updatePlayer(state, (p) => ({ ...p, tokens: p.tokens - TOKEN_COST })),
        song: action.song,
        slot: null,
        usedIds: [...state.usedIds, action.song.id],
      }

    case 'buy': {
      // משלמים 3 אסימונים והשיר נכנס לציר אוטומטית במקום הנכון
      if (state.phase !== 'listen' || !state.song || player.tokens < TOKEN_COST) return state
      const song = state.song
      const next: GameState = {
        ...state,
        phase: 'reveal',
        slot: autoSlot(player, song.year),
        players: updatePlayer(state, (p) => {
          const slot = autoSlot(p, song.year)
          return { ...p, tokens: p.tokens - TOKEN_COST, timeline: insertAt(p.timeline, slot, song) }
        }),
        result: { how: 'bought', correct: true, guessed: null },
      }
      return { ...next, winner: checkWinner(next) }
    }

    case 'wrongYear': {
      // "השנה שגויה": מבטלים את התור בלי עונש – השיר יוצא מהציר (אם נכנס), ואותו שחקן מקבל שיר חדש.
      // אסימונים ששולמו על קנייה מוחזרים.
      if (state.phase !== 'reveal' || !state.song) return state
      const bad = state.song
      const refund = state.result?.how === 'bought' ? TOKEN_COST : 0
      return {
        ...state,
        phase: 'listen',
        players: updatePlayer(state, (p) => ({
          ...p,
          tokens: p.tokens + refund,
          timeline: p.timeline.filter((s) => s.id !== bad.id),
        })),
        song: action.song,
        slot: null,
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
