import { createSongQueue, type SongQueue } from '../songs/queue'
import type { Song } from '../songs/types'
import { newGame, type GameState, type Settings } from './game'
import { newSoloGame, type SoloState } from './solo'
import { newExtremeGame, type ExtremeState } from './extreme'

export type AnyGame = GameState | SoloState | ExtremeState

export const isSolo = (g: AnyGame): g is SoloState => g.mode === 'solo'
export const isExtreme = (g: AnyGame): g is ExtremeState => g.mode === 'extreme'

/** כמה שירי פתיחה צריך לכל מצב */
function startersNeeded(settings: Settings): number {
  if (settings.mode === 'solo') return 1
  if (settings.mode === 'extreme') return 1 // ציר משותף אחד
  return settings.players.length
}

/** מכין משחק חדש: טוען שירי פתיחה (והתור ממשיך לטעון ברקע) */
export async function startGame(settings: Settings, onProgress: (msg: string) => void): Promise<{ game: AnyGame; queue: SongQueue }> {
  const n = startersNeeded(settings)
  const queue = createSongQueue(settings.source, [], Math.max(4, n + 2))
  const starters: Song[] = []
  for (let i = 0; i < n; i++) {
    onProgress(n > 1 ? `מכין שירי פתיחה ${i + 1}/${n}…` : 'מכין את השיר הראשון…')
    const s = await queue.take()
    if (!s) throw new Error('לא נמצאו מספיק שירים במקור שנבחר')
    starters.push(s)
  }
  if (settings.mode === 'solo') return { game: newSoloGame(settings, starters[0]), queue }
  if (settings.mode === 'extreme') return { game: newExtremeGame(settings, starters[0]), queue }
  return { game: newGame({ ...settings, mode: 'classic' }, starters), queue }
}
