// מצב אקסטרים (קבוצות):
// - שתי קבוצות, ציר זמן משותף אחד שמתחיל משיר פתיחה גלוי.
// - הקבוצות מתחלפות. בכל תור הקבוצה שבתור ממקמת שיר חדש בציר המשותף.
// - נכון: השיר נשאר בציר. טעות: מינוס לב, והשיר נזרק.
// - לכל קבוצה 3 לבבות. קבוצה שנגמרו לה הלבבות נפסלת – השנייה מנצחת.
// - קליעה לשנה המדויקת (עם מיקום נכון) מחזירה לב שאבד (אם יש כזה).
// - אין אסימונים ואין אתגרים.
import type { Song } from '../songs/types'
import type { Settings } from './game'
import { makeEvent, type GameEvent } from './events'
import { isPlacementCorrect } from './rules'
import { EXTREME_LIVES } from './modes'
import { exactYearHit } from './bonus'

export interface Team {
  name: string
  lives: number
  /** כמה שירים הקבוצה מיקמה נכון */
  correct: number
}

export interface ExtremeResult {
  correct: boolean
  exactHit: boolean
  lifeLost: boolean
  lifeRestored: boolean
  eliminated: boolean
}

export interface ExtremeState {
  mode: 'extreme'
  settings: Settings
  teams: [Team, Team]
  /** הציר המשותף */
  timeline: Song[]
  current: 0 | 1
  phase: 'pass' | 'listen' | 'reveal' | 'over'
  song: Song | null
  slot: number | null
  result: ExtremeResult | null
  winner: 0 | 1 | null
  events: GameEvent[]
  usedIds: string[]
  turn: number
  turnStartedAt: number | null
}

export type ExtremeAction =
  | { type: 'beginTurn'; song: Song; at?: number }
  | { type: 'select'; slot: number }
  | { type: 'reveal'; at?: number; exactGuess?: number | null }
  | { type: 'wrongYear'; song: Song }
  | { type: 'next' }
  | { type: 'end' }

export function newExtremeGame(settings: Settings, starter: Song): ExtremeState {
  const names = settings.teams ?? ['קבוצה א', 'קבוצה ב']
  return {
    mode: 'extreme',
    settings,
    teams: [
      { name: names[0], lives: EXTREME_LIVES, correct: 0 },
      { name: names[1], lives: EXTREME_LIVES, correct: 0 },
    ],
    timeline: [starter],
    current: 0,
    phase: 'pass',
    song: null,
    slot: null,
    result: null,
    winner: null,
    events: [],
    usedIds: [starter.id],
    turn: 1,
    turnStartedAt: null,
  }
}

const other = (i: 0 | 1): 0 | 1 => (i === 0 ? 1 : 0)

function insertAt<T>(arr: T[], index: number, item: T): T[] {
  return [...arr.slice(0, index), item, ...arr.slice(index)]
}

function setTeam(teams: [Team, Team], i: 0 | 1, fn: (t: Team) => Team): [Team, Team] {
  return i === 0 ? [fn(teams[0]), teams[1]] : [teams[0], fn(teams[1])]
}

export function extremeReducer(state: ExtremeState, action: ExtremeAction): ExtremeState {
  const team = state.teams[state.current]

  switch (action.type) {
    case 'beginTurn':
      if (state.phase !== 'pass') return state
      return {
        ...state,
        phase: 'listen',
        song: action.song,
        slot: null,
        result: null,
        turnStartedAt: action.at ?? null,
        usedIds: [...state.usedIds, action.song.id],
      }

    case 'select':
      if (state.phase !== 'listen' || action.slot < 0 || action.slot > state.timeline.length) return state
      return { ...state, slot: action.slot }

    case 'reveal': {
      if (state.phase !== 'listen' || !state.song || state.slot === null) return state
      const song = state.song
      const slot = state.slot
      const years = state.timeline.map((s) => s.year)
      const correct = isPlacementCorrect(years, slot, song.year)
      const exactHit = correct && exactYearHit(action.exactGuess, song.year)
      const lifeRestored = exactHit && team.lives < EXTREME_LIVES
      const lives = correct ? team.lives + (lifeRestored ? 1 : 0) : team.lives - 1
      const eliminated = lives <= 0
      return {
        ...state,
        phase: 'reveal',
        timeline: correct ? insertAt(state.timeline, slot, song) : state.timeline,
        teams: setTeam(state.teams, state.current, (t) => ({ ...t, lives: Math.max(0, lives), correct: t.correct + (correct ? 1 : 0) })),
        result: { correct, exactHit, lifeLost: !correct, lifeRestored, eliminated },
        winner: eliminated ? other(state.current) : null,
        events: [
          ...state.events,
          makeEvent({
            turn: state.turn, actor: team.name, actorIndex: state.current, song, years, slot, correct, how: 'placed',
            exactGuess: action.exactGuess ?? null, exactHit, startedAt: state.turnStartedAt, at: action.at,
          }),
        ],
      }
    }

    case 'wrongYear': {
      // "השנה שגויה": מבטלים את התור בלי עונש – מחזירים את המצב לקדמותו, ואותה קבוצה מקבלת שיר אחר
      if (state.phase !== 'reveal' || !state.song || !state.result) return state
      const bad = state.song
      const r = state.result
      return {
        ...state,
        phase: 'listen',
        timeline: state.timeline.filter((s) => s.id !== bad.id),
        teams: setTeam(state.teams, state.current, (t) => ({
          ...t,
          lives: t.lives + (r.lifeLost ? 1 : 0) - (r.lifeRestored ? 1 : 0),
          correct: t.correct - (r.correct ? 1 : 0),
        })),
        song: action.song,
        slot: null,
        result: null,
        winner: null,
        events: state.events.filter((e) => !(e.turn === state.turn && e.songId === bad.id)),
        usedIds: [...state.usedIds, action.song.id],
      }
    }

    case 'next':
      if (state.phase !== 'reveal') return state
      if (state.winner !== null) return { ...state, phase: 'over' }
      return {
        ...state,
        phase: 'pass',
        current: other(state.current),
        song: null,
        slot: null,
        result: null,
        turn: state.turn + 1,
      }

    case 'end': {
      // סיום מוקדם: מנצחת הקבוצה עם יותר לבבות, ואם שווה – עם יותר מיקומים נכונים. אחרת תיקו.
      const [a, b] = state.teams
      const winner: 0 | 1 | null = a.lives !== b.lives ? (a.lives > b.lives ? 0 : 1) : a.correct !== b.correct ? (a.correct > b.correct ? 0 : 1) : null
      return { ...state, phase: 'over', winner }
    }
  }
}
