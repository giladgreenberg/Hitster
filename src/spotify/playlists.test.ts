import { describe, expect, it } from 'vitest'
import { playedUris, summaryName } from './playlists'
import { layoutRows } from '../share/shareCard'

describe('פלייליסט סיכום', () => {
  it('שם עם תאריך בפורמט ישראלי', () => {
    expect(summaryName(new Date(2026, 10, 1))).toBe('היטסטר – 1.11.2026')
  })
  it('שירים לפי סדר ההשמעה, בלי כפילויות ובלי "השנה שגויה"', () => {
    expect(playedUris(['a', 'b', 'a', 'c', 'd'], new Set(['c']))).toEqual(['spotify:track:a', 'spotify:track:b', 'spotify:track:d'])
  })
})

describe('כרטיס שיתוף', () => {
  it('עד 12 שורות; מעבר לזה – 11 שירים ושורת "ועוד"', () => {
    expect(layoutRows(5)).toEqual({ shown: 5, more: 0 })
    expect(layoutRows(12)).toEqual({ shown: 12, more: 0 })
    expect(layoutRows(30)).toEqual({ shown: 11, more: 19 })
  })
})
