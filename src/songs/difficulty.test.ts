import { describe, expect, it } from 'vitest'
import { offsetRange, passesDifficulty } from './difficulty'
import { releaseCountFromIsrcResponse } from './musicbrainz'

describe('רמת קושי', () => {
  it('קל: רק מהתוצאות הראשונות', () => {
    expect(offsetRange('easy', 5000)).toEqual([0, 40])
    expect(offsetRange('easy', 25)).toEqual([0, 15])
  })
  it('בינוני: עד 300', () => {
    expect(offsetRange('medium', 5000)).toEqual([0, 290])
  })
  it('קשה: מהחלק העמוק, ולא חורג מהמגבלה של ספוטיפיי', () => {
    expect(offsetRange('hard', 5000)).toEqual([300, 990])
    expect(offsetRange('hard', 120)).toEqual([60, 110])
    expect(offsetRange('hard', 5)).toEqual([0, 0])
  })
  it('סינון לפי מספר הוצאות', () => {
    expect(passesDifficulty('easy', 12)).toBe(true)
    expect(passesDifficulty('easy', 2)).toBe(false)
    expect(passesDifficulty('easy', null)).toBe(false) // לא מוכר ל-MusicBrainz – כנראה לא להיט
    expect(passesDifficulty('hard', 2)).toBe(true)
    expect(passesDifficulty('hard', 30)).toBe(false)
    expect(passesDifficulty('hard', null)).toBe(true)
    expect(passesDifficulty('medium', 30)).toBe(true)
    expect(passesDifficulty(undefined, 0)).toBe(true)
  })
  it('סופר הוצאות שונות מכל ההקלטות', () => {
    const json = { recordings: [{ releases: [{ id: 'a' }, { id: 'b' }] }, { releases: [{ id: 'b' }, { id: 'c' }] }] }
    expect(releaseCountFromIsrcResponse(json)).toBe(3)
    expect(releaseCountFromIsrcResponse({})).toBe(0)
  })
})
