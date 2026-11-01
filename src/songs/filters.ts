// מילים שמעידות על גרסה שאינה המקורית (רימאסטר, הופעה חיה, אוסף וכו').
// משתמשים בזה רק כשאין תשובה מ-MusicBrainz: אז שנת ספוטיפיי לא אמינה ומדלגים על השיר.
const SUSPICIOUS = [
  'remaster',
  'remastered',
  'live',
  'greatest hits',
  'best of',
  'collection',
  'anniversary',
  'deluxe',
]

const PATTERN = new RegExp(`\\b(${SUSPICIOUS.map((w) => w.replace(/ /g, '\\s+')).join('|')})\\b`, 'i')

export function isSuspiciousTitle(text: string): boolean {
  return PATTERN.test(text)
}

export function isSuspiciousTrack(trackName: string, albumName: string): boolean {
  return isSuspiciousTitle(trackName) || isSuspiciousTitle(albumName)
}

/** "1987-05-12" / "1987" / "0000" → 1987 או null */
export function parseYear(date: string | null | undefined): number | null {
  if (!date) return null
  const y = Number(date.slice(0, 4))
  return Number.isFinite(y) && y >= 1900 && y <= new Date().getFullYear() + 1 ? y : null
}
