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

/**
 * מחזיר את השנה המקורית לפי MusicBrainz, או null אם אין מידע.
 * תוצאות נשמרות במטמון (localStorage) כדי לא לחפש פעמיים.
 */
export async function lookupOriginalYear(isrc: string): Promise<number | null> {
  const key = isrc.toUpperCase()
  const cached = getCachedYear(key)
  if (cached !== undefined) return cached

  const url = `${BASE}/isrc/${encodeURIComponent(key)}?inc=releases&fmt=json`
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response
    try {
      res = await throttled(() => mbFetch(url))
    } catch {
      return null // בעיית רשת – לא שומרים במטמון, אולי בפעם הבאה יצליח
    }
    if (res.status === 404) {
      setCachedYear(key, null)
      return null
    }
    if (res.status === 503 || res.status === 429) {
      await sleep(2000 * (attempt + 1)) // חרגנו מהקצב – מחכים ומנסים שוב
      continue
    }
    if (!res.ok) return null
    const year = earliestYearFromIsrcResponse(await res.json())
    setCachedYear(key, year)
    return year
  }
  return null
}
