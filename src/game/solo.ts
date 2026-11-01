// מצב סולו: שחקן אחד מול השעון. כמה שירים ברצף בלי לטעות?
// - לכל תור יש שעון עצר (soloSeconds). נגמר הזמן לפני החשיפה = טעות.
// - הטעות הראשונה מסיימת את המשחק.
// - ניקוד: נקודה לכל שיר שמוקם נכון, ועוד נקודה בונוס על קליעה לשנה המדויקת (רק אם המיקום נכון).
import type { Song } from '../songs/types'
import type { Settings } from './game'
import { makeEvent, type GameEvent } from './events'
import { isPlacementCorrect } from './rules'
import { DEFAULT_SOLO_SECONDS } from './modes'
import { exactYearHit } from './bonus'

export interface SoloResult {
  correct: boolean
  timeout: boolean
  exactHit: boolean
  points: number
  gameOver: boolean
}

export interface SoloState {
  mode: 'solo'
  settings: Settings
  name: string
  timeline: Song[]
  /** ready = לפני השיר הבא, listen = מאזינים וממקמים, reveal = חשיפה, over = סוף */
  phase: 'ready' | 'listen' | 'reveal' | 'over'
  song: Song | null
  slot: number | null
  score: number
  /** מתי השעון התחיל (כשהשיר התחיל להתנגן). null = עוד לא התחיל */
  timerStartedAt: number | null
  result: SoloResult | null
  events: GameEvent[]
  usedIds: string[]
  turn: number
}

export type SoloAction =
  | { type: 'beginTurn'; song: Song }
  | { type: 'timerStart'; at: number }
  | { type: 'select'; slot: number }
  | { type: 'reveal'; at: number; exactGuess?: number | null }
  | { type: 'timeout'; at: number }
  | { type: 'wrongYear'; song: Song }
  | { type: 'finish' }

export function newSoloGame(settings: Settings, starter: Song): SoloState {
  return {
    mode: 'solo',
    settings,
    name: settings.soloName ?? settings.players[0] ?? 'שחקן',
    timeline: [starter],
    phase: 'ready',
    song: null,
    slot: null,
    score: 0,
    timerStartedAt: null,
    result: null,
    events: [],
    usedIds: [starter.id],
    turn: 1,
  }
}

export const soloSeconds = (s: SoloState) => s.settings.soloSeconds ?? DEFAULT_SOLO_SECONDS

/** כמה מילישניות נשארו בשעון (null = השעון עוד לא התחיל) */
export function timeLeftMs(s: SoloState, now: number): number | null {
  if (s.phase !== 'listen' || s.timerStartedAt === null) return null
  return Math.max(0, s.timerStartedAt + soloSeconds(s) * 1000 - now)
}

function insertAt<T>(arr: T[], index: number, item: T): T[] {
  return [...arr.slice(0, index), item, ...arr.slice(index)]
}

export function soloReducer(state: SoloState, action: SoloAction): SoloState {
  switch (action.type) {
    case 'beginTurn': {
      const canStart = state.phase === 'ready' || (state.phase === 'reveal' && !state.result?.gameOver)
      if (!canStart) return state
      return {
        ...state,
        phase: 'listen',
        song: action.song,
        slot: null,
        timerStartedAt: null,
        result: null,
        turn: state.phase === 'reveal' ? state.turn + 1 : state.turn,
        usedIds: [...state.usedIds, action.song.id],
      }
    }

    case 'timerStart':
      if (state.phase !== 'listen' || state.timerStartedAt !== null) return state
      return { ...state, timerStartedAt: action.at }

    case 'select':
      if (state.phase !== 'listen' || action.slot < 0 || action.slot > state.timeline.length) return state
      return { ...state, slot: action.slot }

    case 'reveal': {
      if (state.phase !== 'listen' || !state.song || state.slot === null) return state
      // חשיפה אחרי שהזמן נגמר = טעות בתום הזמן
      const left = timeLeftMs(state, action.at)
      if (left !== null && left <= 0) return soloReducer(state, { type: 'timeout', at: action.at })
      const song = state.song
      const years = state.timeline.map((s) => s.year)
      const correct = isPlacementCorrect(years, state.slot, song.year)
      const exactHit = correct && exactYearHit(action.exactGuess, song.year)
      const points = correct ? 1 + (exactHit ? 1 : 0) : 0
      return {
        ...state,
        phase: 'reveal',
        timeline: correct ? insertAt(state.timeline, state.slot, song) : state.timeline,
        score: state.score + points,
        result: { correct, timeout: false, exactHit, points, gameOver: !correct },
        events: [
          ...state.events,
          makeEvent({
            turn: state.turn, actor: state.name, actorIndex: 0, song, years, slot: state.slot, correct, how: 'placed',
            exactGuess: action.exactGuess ?? null, exactHit, startedAt: state.timerStartedAt, at: action.at,
          }),
        ],
      }
    }

    case 'timeout': {
      if (state.phase !== 'listen' || !state.song) return state
      const years = state.timeline.map((s) => s.year)
      return {
        ...state,
        phase: 'reveal',
        result: { correct: false, timeout: true, exactHit: false, points: 0, gameOver: true },
        events: [
          ...state.events,
          makeEvent({
            turn: state.turn, actor: state.name, actorIndex: 0, song: state.song, years, slot: state.slot, correct: false, how: 'timeout',
            startedAt: state.timerStartedAt, at: action.at,
          }),
        ],
      }
    }

    case 'wrongYear': {
      // "השנה שגויה": מבטלים את התור – מחזירים את הניקוד והשיר, ומקבלים שיר אחר
      if (state.phase !== 'reveal' || !state.song) return state
      const bad = state.song
      return {
        ...state,
        phase: 'listen',
        timeline: state.timeline.filter((s) => s.id !== bad.id),
        score: state.score - (state.result?.points ?? 0),
        song: action.song,
        slot: null,
        timerStartedAt: null,
        result: null,
        events: state.events.filter((e) => !(e.turn === state.turn && e.songId === bad.id)),
        usedIds: [...state.usedIds, action.song.id],
      }
    }

    case 'finish':
      if (state.phase === 'over') return state
      return { ...state, phase: 'over' }
  }
}
