import { describe, expect, it, vi } from 'vitest'

// מדמים את ספוטיפיי: רק "rock" בשנים זוגיות מחזיר שירים; כל שאר הצירופים ריקים
const calls: string[] = []
vi.mock('../spotify/api', () => ({
  searchTracks: vi.fn(async (q: string, offset: number) => {
    calls.push(q)
    const year = Number(/year:(\d+)/.exec(q)?.[1])
    const ok = q.includes('genre:"rock"') && year % 2 === 0
    if (!ok || offset >= 30) return { items: [], total: ok ? 30 : 0 }
    return {
      total: 30,
      items: Array.from({ length: 10 }, (_, i) => ({ id: `${year}-${offset + i}`, uri: `spotify:track:${year}-${offset + i}`, name: 'שיר', artists: [{ name: 'א' }], duration_ms: 1, album: { name: 'x', release_date: String(year), images: [] } })),
    }
  }),
  getPlaylistTracks: vi.fn(async () => []),
  getTrack: vi.fn(),
}))
vi.mock('./resolveSong', () => ({
  resolveSong: vi.fn(async (t: { id: string; album: { release_date: string } }) => ({ ok: true, song: { id: t.id, year: Number(t.album.release_date), yearSource: 'spotify' } })),
}))
vi.mock('./blacklist', () => ({ getBlacklist: () => new Set() }))

import { createSongSource } from './sources'

describe('מקור אקראי עם הרבה ז\'אנרים', () => {
  it('צירופים ריקים לא נחשבים "נגמרו השירים" – ממשיכים לחפש', async () => {
    const genres = ['pop', 'rock', 'reggae', 'latin', 'jazz', 'blues', 'metal', 'punk', 'country', 'funk']
    const src = createSongSource({ kind: 'random', fromYear: 1970, toYear: 1979, genres })
    const songs = []
    for (let i = 0; i < 15; i++) songs.push(await src.next())
    expect(songs.every((s) => s !== null)).toBe(true)
    expect(songs.every((s) => s!.year % 2 === 0)).toBe(true)
    expect(new Set(songs.map((s) => s!.id)).size).toBe(15) // בלי כפילויות
  })

  it('לא חוזרים לצירוף שכבר ידוע שהוא ריק', async () => {
    calls.length = 0
    const src = createSongSource({ kind: 'random', fromYear: 1970, toYear: 1971, genres: ['rock', 'reggae'] })
    for (let i = 0; i < 5; i++) await src.next()
    const emptyQueries = calls.filter((q) => !(q.includes('rock') && q.includes('1970')))
    // כל צירוף ריק נשאל לכל היותר פעם אחת
    expect(new Set(emptyQueries).size).toBe(emptyQueries.length)
  })
})

describe('רמת קושי לא תוקעת את המשחק', () => {
  it('גם כשאף שיר לא עובר את סינון "קל" – בסוף מתקבל שיר', async () => {
    // resolveSong המדומה לא מחזיר mbReleases, אז סינון "קל" דוחה הכול
    const src = createSongSource({ kind: 'random', fromYear: 1970, toYear: 1979, genres: ['rock'], difficulty: 'easy' })
    const s = await src.next()
    expect(s).not.toBe(null)
  })
})

describe('חיסכון בבקשות', () => {
  it('משתמשים בכמה שירים מכל חיפוש – פחות חיפושים משירים', async () => {
    calls.length = 0
    const src = createSongSource({ kind: 'random', fromYear: 1970, toYear: 1970, genres: ['rock'] })
    for (let i = 0; i < 10; i++) await src.next()
    expect(calls.length).toBeLessThan(10)
  })
})
