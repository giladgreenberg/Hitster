import { describe, expect, it } from 'vitest'
import { isSuspiciousTrack, parseYear } from './filters'
import { earliestYearFromIsrcResponse } from './musicbrainz'

describe('isSuspiciousTrack', () => {
  it('מזהה רימאסטר, הופעה חיה ואוספים', () => {
    expect(isSuspiciousTrack('Take On Me - 2015 Remaster', 'Hunting High and Low')).toBe(true)
    expect(isSuspiciousTrack('Hotel California', 'Hell Freezes Over (Live)')).toBe(true)
    expect(isSuspiciousTrack('Song', 'The Best Of Queen')).toBe(true)
    expect(isSuspiciousTrack('Song', 'Greatest  Hits')).toBe(true)
    expect(isSuspiciousTrack('Song', 'Thriller 25th Anniversary Deluxe')).toBe(true)
  })
  it('לא נופל על מילים שרק מכילות את המחרוזת', () => {
    expect(isSuspiciousTrack('Alive', 'Ten')).toBe(false)
    expect(isSuspiciousTrack('Live and Let Die', 'x')).toBe(true) // מילה שלמה – עדיף לדלג
    expect(isSuspiciousTrack('Deliver Me', 'Bestiary')).toBe(false)
  })
})

describe('parseYear', () => {
  it('מפרש תאריכים חלקיים ומסנן שטויות', () => {
    expect(parseYear('1987-05-12')).toBe(1987)
    expect(parseYear('1987')).toBe(1987)
    expect(parseYear('0000')).toBe(null)
    expect(parseYear(undefined)).toBe(null)
  })
})

describe('earliestYearFromIsrcResponse', () => {
  it('לוקח את השנה המוקדמת ביותר מכל ההקלטות וההוצאות', () => {
    const json = {
      recordings: [
        { 'first-release-date': '1985-04', releases: [{ date: '2015-01-01' }, { date: '' }] },
        { releases: [{ date: '1984-10-19' }] },
      ],
    }
    expect(earliestYearFromIsrcResponse(json)).toBe(1984)
  })
  it('מחזיר null כשאין תאריכים', () => {
    expect(earliestYearFromIsrcResponse({ recordings: [{ releases: [] }] })).toBe(null)
    expect(earliestYearFromIsrcResponse({})).toBe(null)
  })
})
