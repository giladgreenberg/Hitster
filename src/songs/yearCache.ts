// מטמון שנים ב-localStorage: ISRC → שנה מקורית (או null = MusicBrainz לא מכיר).
const KEY = 'hitster.yearCache.v1'

type Cache = Record<string, number | null>

let mem: Cache | null = null

function load(): Cache {
  if (mem) return mem
  try {
    mem = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Cache
  } catch {
    mem = {}
  }
  return mem
}

/** undefined = עוד לא חיפשנו; null = חיפשנו ולא נמצא */
export function getCachedYear(isrc: string): number | null | undefined {
  const c = load()
  return isrc in c ? c[isrc] : undefined
}

export function setCachedYear(isrc: string, year: number | null) {
  const c = load()
  c[isrc] = year
  try {
    localStorage.setItem(KEY, JSON.stringify(c))
  } catch {
    /* המקום נגמר – לא נורא */
  }
}
