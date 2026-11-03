// חיפוש בעברית ובאנגלית: מנרמל ניקוד, גרשיים, סוגריים ואותיות סופיות
const FINALS: Record<string, string> = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' }

export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '') // ניקוד וטעמים
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])
    .replace(/["'`״׳()\[\]{}.,:;!?\\/–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** מחזיר true אם כל מילות החיפוש נמצאות בטקסט */
export function matches(query: string, ...fields: (string | undefined | string[])[]): boolean {
  const q = norm(query)
  if (!q) return true
  const hay = norm(fields.flat().filter(Boolean).join(' | '))
  const compact = hay.replace(/ /g, '')
  return q.split(' ').every((w) => hay.includes(w) || compact.includes(w))
}
