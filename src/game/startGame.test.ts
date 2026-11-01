import { describe, expect, it, vi } from 'vitest'

// התור המדומה: מחזיר שירים, וממשיך "לבדוק" שירים ברקע גם אחרי ההתחלה
let logger: ((m: string) => void) | undefined
vi.mock('../songs/queue', () => ({
  createSongQueue: (_c: unknown, _u: unknown, _s: unknown, log?: (m: string) => void) => {
    logger = log
    let n = 0
    return {
      warmUp() {},
      readyCount: () => 1,
      async take() {
        log?.('✓')
        n++
        return { id: `s${n}`, uri: '', name: 'x', artists: 'y', album: '', coverUrl: null, albumUri: null, durationMs: 1, isrc: null, spotifyYear: 1990, year: 1990, yearSource: 'spotify', mbStatus: '' }
      },
    }
  },
}))

import { startGame } from './startGame'

describe('התחלת משחק', () => {
  it('הודעות ההתקדמות נעצרות אחרי שהמשחק התחיל (טעינה ברקע לא מחזירה למסך "טוען")', async () => {
    const progress = vi.fn()
    await startGame({ mode: 'solo', players: [], source: { kind: 'random', fromYear: 1970, toYear: 2000, genres: ['rock'] }, targetSongs: 10, randomStart: false, guessBonus: false }, progress)
    const before = progress.mock.calls.length
    expect(before).toBeGreaterThan(0)
    logger?.('✓ שיר שנטען ברקע')
    logger?.('✓ עוד אחד')
    expect(progress.mock.calls.length).toBe(before)
  })
})
