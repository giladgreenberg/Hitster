import { createSongQueue, type SongQueue } from '../songs/queue'
import type { Song } from '../songs/types'
import { newGame, type GameState, type Settings } from './game'

/** מכין משחק חדש: טוען שיר פתיחה לכל שחקן (והתור ממשיך לטעון ברקע) */
export async function startGame(settings: Settings, onProgress: (msg: string) => void): Promise<{ game: GameState; queue: SongQueue }> {
  const n = settings.players.length
  const queue = createSongQueue(settings.source, [], Math.max(4, n + 2))
  const starters: Song[] = []
  for (let i = 0; i < n; i++) {
    onProgress(`מכין שירי פתיחה ${i + 1}/${n}…`)
    const s = await queue.take()
    if (!s) throw new Error('לא נמצאו מספיק שירים במקור שנבחר')
    starters.push(s)
  }
  return { game: newGame(settings, starters), queue }
}
