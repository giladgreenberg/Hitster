// חיפוש השנה המקורית של הקלטה ב-MusicBrainz לפי ISRC.
// כללי MusicBrainz: לכל היותר בקשה אחת לשנייה, ו-User-Agent מזהה עם פרטי קשר.
// https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting

import { getCachedYear, setCachedYear } from './yearCache'
import { parseYear } from './filters'

const BASE = 'https://musicbrainz.org/ws/2'
export const USER_AGENT = 'Hitster2-WebGame/0.1 ( https://github.com/giladgreenberg/Hitster )'
const MIN_GAP_MS = 1100

// ---------- תור: בקשה אחת לשנייה לכל היותר ----------
let chain: Promise<unknown> = Promise.resolve()
let lastRequestAt = 0
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = lastRequestAt + MIN_GAP_MS - Date.now()
    if (wait > 0) await sleep(wait)
    lastRequestAt = Date.now()
    return fn()
  })
  chain = run.catch(() => undefined)
  return run
}

// דפדפנים מסוימים לא מאפשרים לקבוע User-Agent, או שהכותרת גורמת לכשל CORS.
// מנסים פעם אחת עם הכותרת; אם זה נכשל ממשיכים בלעדיה (הדפדפן שולח User-Agent משלו).
let sendUserAgent = true

async function mbFetch(url: string): Promise<Response> {
  if (sendUserAgent) {
    try {
      return await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } })
    } catch {
      sendUserAgent = false
    }
  }
  return fetch(url, { headers: { Accept: 'application/json' } })
}

// ---------- ניתוח התשובה ----------
interface MbIsrcResponse {
  recordings?: {
    'first-release-date'?: string
    releases?: { date?: string }[]
  }[]
}

/** השנה המוקדמת ביותר מכל ההקלטות וההוצאות שמקושרות ל-ISRC. */
export function earliestYearFromIsrcResponse(json: MbIsrcResponse): number | null {
  let best: number | null = null
  for (const rec of json.recordings ?? []) {
    const dates = [rec['first-release-date'], ...(rec.releases ?? []).map((r) => r.date)]
    for (const d of dates) {
      const y = parseYear(d)
      if (y !== null && (best === null || y < best)) best = y
    }
  }
  return best
}

export interface MbLookup {
  year: number | null
  /** תיאור קצר של מה שקרה – להצגה במסך הבדיקה */
  status: string
}

/**
 * מחזיר את השנה המקורית לפי MusicBrainz (year=null אם אין מידע), ותיאור של מה שקרה.
 * תוצאות נשמרות במטמון (localStorage) כדי לא לחפש פעמיים.
 */
export async function lookupOriginalYear(isrc: string): Promise<MbLookup> {
  const key = isrc.toUpperCase()
  const cached = getCachedYear(key)
  if (cached !== undefined) return { year: cached, status: cached === null ? 'לא נמצא (מהמטמון)' : 'נמצא (מהמטמון)' }

  const url = `${BASE}/isrc/${encodeURIComponent(key)}?inc=releases&fmt=json`
  let lastStatus = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response
    try {
      res = await throttled(() => mbFetch(url))
    } catch (e) {
      // בעיית רשת/CORS – לא שומרים במטמון, אולי בפעם הבאה יצליח
      return { year: null, status: `שגיאת רשת: ${e instanceof Error ? e.message : String(e)}` }
    }
    if (res.status === 404) {
      setCachedYear(key, null)
      return { year: null, status: 'ה-ISRC לא קיים במאגר (404)' }
    }
    if (res.status === 503 || res.status === 429) {
      lastStatus = `עומס (${res.status})`
      await sleep(2000 * (attempt + 1)) // חרגנו מהקצב – מחכים ומנסים שוב
      continue
    }
    if (!res.ok) return { year: null, status: `שגיאה ${res.status}` }
    const year = earliestYearFromIsrcResponse(await res.json())
    setCachedYear(key, year)
    return { year, status: year === null ? 'נמצא אבל בלי תאריך' : `נמצא: ${year}` }
  }
  return { year: null, status: lastStatus || 'נכשל' }
}
