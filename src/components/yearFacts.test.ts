import { describe, expect, it } from 'vitest'
import facts from '../data/yearFacts.json'

describe('עובדות לפי שנה', () => {
  it('לכל שנה מ-1950 עד השנה הנוכחית יש 1–3 עובדות לא ריקות', () => {
    const data = facts as Record<string, string[]>
    const last = Math.min(new Date().getFullYear(), 2026)
    for (let y = 1950; y <= last; y++) {
      const list = data[String(y)]
      expect(list, `שנה ${y}`).toBeDefined()
      expect(list.length, `שנה ${y}`).toBeGreaterThanOrEqual(1)
      expect(list.length, `שנה ${y}`).toBeLessThanOrEqual(3)
      for (const f of list) expect(f.trim().length, `שנה ${y}`).toBeGreaterThan(5)
    }
  })
})
