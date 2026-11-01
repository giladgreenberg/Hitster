import { describe, expect, it } from 'vitest'
import type { GameEvent } from './events'
import { accuracy, biggestMiss, highlight, longestStreak, missDistance, strongestDecades } from './stats'

let turn = 0
function ev(actor: string, year: number, correct: boolean, over: Partial<GameEvent> = {}): GameEvent {
  turn++
  return {
    turn, actor, actorIndex: 0, songId: `s${turn}`, songName: `שיר ${turn}`, artists: 'א', year,
    slot: 0, before: null, after: null, correct, how: 'placed', exactGuess: null, exactHit: false,
    durationMs: null, timelineSize: 3, ...over,
  }
}

describe('העשור החזק', () => {
  it('בוחר את העשור עם אחוז ההצלחה הגבוה, רק עם 2 שירים לפחות', () => {
    const events = [
      ev('דנה', 1981, true), ev('דנה', 1985, true), ev('דנה', 1988, false), // 80s: 2/3
      ev('דנה', 1992, true), ev('דנה', 1995, true), // 90s: 2/2
      ev('דנה', 1971, true), // 70s: רק שיר אחד – לא נחשב
    ]
    expect(strongestDecades(events).get('דנה')).toMatchObject({ decade: 1990, correct: 2, total: 2, rate: 1 })
  })

  it('אין עשור עם 2 שירים – null', () => {
    expect(strongestDecades([ev('יוסי', 1981, true), ev('יוסי', 1991, true)]).get('יוסי')).toBe(null)
  })

  it('בתיקו באחוזים – העשור עם יותר שירים', () => {
    const events = [ev('א', 1961, true), ev('א', 1962, true), ev('א', 2001, true), ev('א', 2002, true), ev('א', 2003, true)]
    expect(strongestDecades(events).get('א')?.decade).toBe(2000)
  })

  it('כל שחקן מקבל את העשור שלו, ואתגרים וקניות לא נספרים', () => {
    const events = [
      ev('א', 1981, true), ev('א', 1982, true),
      ev('ב', 2011, true), ev('ב', 2012, true),
      ev('ב', 1983, false, { how: 'challenge' }), ev('ב', 1984, true, { how: 'bought' }),
    ]
    const s = strongestDecades(events)
    expect(s.get('א')?.decade).toBe(1980)
    expect(s.get('ב')).toMatchObject({ decade: 2010, total: 2 })
  })
})

describe('הטעות הכי גדולה', () => {
  it('מרחק מהטווח שבו מיקמו', () => {
    expect(missDistance({ year: 1960, before: 1987, after: 1990 })).toBe(27) // מוקדם מהטווח
    expect(missDistance({ year: 2010, before: 1987, after: 1990 })).toBe(20) // מאוחר מהטווח
    expect(missDistance({ year: 1960, before: null, after: 1950 })).toBe(10) // מיקום ראשון
    expect(missDistance({ year: 1960, before: 1970, after: null })).toBe(10) // מיקום אחרון
    expect(missDistance({ year: 1988, before: 1987, after: 1990 })).toBe(0)
  })

  it('בוחר את הטעות עם המרחק הגדול ביותר', () => {
    const events = [
      ev('דני', 1960, false, { before: 1987, after: 1990 }),
      ev('רותי', 1980, false, { before: 1985, after: null }),
      ev('דני', 2000, true, { before: 1990, after: null }),
    ]
    expect(biggestMiss(events)).toMatchObject({ actor: 'דני', distance: 27, year: 1960 })
  })

  it('בלי טעויות, או טעות בגלל זמן בלי מיקום – null', () => {
    expect(biggestMiss([ev('א', 1990, true)])).toBe(null)
    expect(biggestMiss([ev('א', 1990, false, { slot: null, how: 'timeout' })])).toBe(null)
  })
})

describe('רגע השיא', () => {
  it('עדיפות 1: שנה מדויקת בשיר הכי ישן', () => {
    const events = [ev('א', 1999, true, { exactHit: true }), ev('ב', 1965, true, { exactHit: true }), ev('א', 1970, true), ev('א', 1971, true), ev('א', 1972, true)]
    expect(highlight(events)).toEqual({ type: 'exact', actor: 'ב', songName: events[1].songName, year: 1965 })
  })

  it('עדיפות 2: הרצף הארוך ביותר (נשבר בטעות)', () => {
    const events = [ev('א', 1990, true), ev('א', 1991, true), ev('ב', 1992, true), ev('א', 1993, false), ev('ב', 1994, true), ev('ב', 1995, true)]
    expect(longestStreak(events)).toEqual({ actor: 'ב', length: 3 })
    expect(highlight(events)).toEqual({ type: 'streak', actor: 'ב', length: 3 })
  })

  it('עדיפות 3: מיקום נכון בציר הכי צפוף', () => {
    const events = [ev('א', 1990, true, { timelineSize: 4 }), ev('א', 1991, false), ev('ב', 1992, true, { timelineSize: 9 }), ev('ב', 1993, false)]
    expect(highlight(events)).toMatchObject({ type: 'dense', actor: 'ב', size: 10 })
  })

  it('בלי מיקומים נכונים – null', () => {
    expect(highlight([ev('א', 1990, false)])).toBe(null)
    expect(highlight([])).toBe(null)
  })
})

describe('אחוז הצלחה', () => {
  it('סופר מיקומים וטעויות בזמן', () => {
    const a = accuracy([ev('א', 1990, true), ev('א', 1991, false, { how: 'timeout', slot: null }), ev('א', 1992, true, { how: 'bought' })])
    expect(a.get('א')).toEqual({ correct: 1, total: 2 })
  })
})
