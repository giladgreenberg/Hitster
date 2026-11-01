import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./auth', () => ({ getAccessToken: async () => 'token', logout: () => {} }))

import { onRateLimitWait, spotifyFetch } from './api'

afterEach(() => vi.unstubAllGlobals())

describe('המתנה קצרה מספוטיפיי (429)', () => {
  it('ממתינים בשקט, מודיעים שממתינים, וממשיכים כשאפשר', async () => {
    let n = 0
    vi.stubGlobal('fetch', vi.fn(async () => (++n <= 2 ? new Response('{}', { status: 429, headers: { 'Retry-After': '1' } }) : new Response('{"ok":true}', { status: 200 }))))
    const waits: number[] = []
    const off = onRateLimitWait((s) => waits.push(s))
    await expect(spotifyFetch<{ ok: boolean }>('/me')).resolves.toEqual({ ok: true })
    off()
    expect(n).toBe(3)
    expect(waits.length).toBeGreaterThan(0)
  }, 15000)
})
