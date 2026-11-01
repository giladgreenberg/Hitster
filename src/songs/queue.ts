// תור טעינה מוקדמת: מחזיק 3–5 שירים מוכנים (כולל שנה מקורית) כדי שלא יהיו המתנות בין תורות.
import { createSongSource, type SourceConfig } from './sources'
import type { Song } from './types'

export function createSongQueue(config: SourceConfig, usedIds: string[] = [], size = 4) {
  const source = createSongSource(config)
  usedIds.forEach((id) => source.markUsed(id))
  const ready: Song[] = []
  let filling: Promise<void> | null = null
  let exhausted = false
  let lastError: Error | null = null

  async function fillLoop() {
    while (ready.length < size && !exhausted) {
      try {
        const s = await source.next()
        if (!s) exhausted = true
        else ready.push(s)
        lastError = null
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))
        break // ננסה שוב בבקשה הבאה
      }
    }
  }

  function fill() {
    filling ??= fillLoop().finally(() => {
      filling = null
    })
    return filling
  }

  return {
    /** מתחיל לטעון ברקע */
    warmUp: () => void fill(),
    /** השיר הבא (מחכה אם אין מוכן). null = המקור נגמר */
    async take(): Promise<Song | null> {
      while (ready.length === 0) {
        if (exhausted) return null
        await fill()
        if (ready.length === 0 && lastError) throw lastError
      }
      const s = ready.shift()!
      void fill()
      return s
    },
    readyCount: () => ready.length,
  }
}

export type SongQueue = ReturnType<typeof createSongQueue>
