import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./auth', () => ({ getAccessToken: async () => 'token', logout: () => {} }))

import { rateLimitSecondsLeft, spotifyFetch, SpotifyRateLimitError } from './api'

afterEach(() => vi.unstubAllGlobals())

describe('מגבלת הקצב של ספוטיפיי (429)', () => {
  it('המתנה ארוכה: לא מנסים שוב, מציגים הודעה ברורה, ולא שולחים בקשות נוספות בזמן החסימה', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 429, headers: { 'Retry-After': '120' } }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(spotifyFetch('/me')).rejects.toBeInstanceOf(SpotifyRateLimitError)
    await expect(spotifyFetch('/me')).rejects.toThrow(/2 דקות/)
    expect(fetchMock).toHaveBeenCalledTimes(1) // הבקשה השנייה לא נשלחה בכלל
    expect(rateLimitSecondsLeft()).toBeGreaterThan(100)
  })
})
