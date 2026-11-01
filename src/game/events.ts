// יומן אירועי המשחק – כל מיקום של שיר נרשם כאן, כדי לחשב סטטיסטיקות בסוף.
import type { Song } from '../songs/types'

export interface GameEvent {
  turn: number
  /** שם השחקן / הקבוצה */
  actor: string
  actorIndex: number
  songId: string
  songName: string
  artists: string
  year: number
  /** החריץ שנבחר (null = לא הספיק למקם / קנה) */
  slot: number | null
  /** השנים של השכנים במקום שנבחר (null = קצה הציר) */
  before: number | null
  after: number | null
  correct: boolean
  how: 'placed' | 'bought' | 'challenge' | 'timeout'
  /** ניחוש השנה המדויקת (אם הוזן) והאם קלע */
  exactGuess: number | null
  exactHit: boolean
  /** כמה זמן לקח מתחילת התור ועד החשיפה */
  durationMs: number | null
  /** כמה שירים היו בציר ברגע המיקום */
  timelineSize: number
}

interface EventInput {
  turn: number
  actor: string
  actorIndex: number
  song: Song
  years: number[]
  slot: number | null
  correct: boolean
  how: GameEvent['how']
  exactGuess?: number | null
  exactHit?: boolean
  startedAt?: number | null
  at?: number
}

export function makeEvent(i: EventInput): GameEvent {
  const slot = i.slot
  return {
    turn: i.turn,
    actor: i.actor,
    actorIndex: i.actorIndex,
    songId: i.song.id,
    songName: i.song.name,
    artists: i.song.artists,
    year: i.song.year,
    slot,
    before: slot !== null && slot > 0 ? i.years[slot - 1] : null,
    after: slot !== null && slot < i.years.length ? i.years[slot] : null,
    correct: i.correct,
    how: i.how,
    exactGuess: i.exactGuess ?? null,
    exactHit: i.exactHit ?? false,
    durationMs: i.startedAt && i.at ? Math.max(0, i.at - i.startedAt) : null,
    timelineSize: i.years.length,
  }
}
