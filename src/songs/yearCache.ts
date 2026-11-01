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

// מספר ההוצאות (releases) של כל ISRC ב-MusicBrainz – סימן לכמה השיר מוכר (להיטים יוצאים בהרבה אוספים)
const REL_KEY = 'hitster.releaseCache.v1'
let relMem: Record<string, number> | null = null

function loadRel(): Record<string, number> {
  if (relMem) return relMem
  try {
    relMem = JSON.parse(localStorage.getItem(REL_KEY) ?? '{}') as Record<string, number>
  } catch {
    relMem = {}
  }
  return relMem
}

export function getCachedReleases(isrc: string): number | undefined {
  return loadRel()[isrc]
}

export function setCachedReleases(isrc: string, count: number) {
  const c = loadRel()
  c[isrc] = count
  try {
    localStorage.setItem(REL_KEY, JSON.stringify(c))
  } catch {
    /* ignore */
  }
}
