// חוקי המיקום בציר הזמן.
// ציר הזמן ממוין מהשנה המוקדמת למאוחרת. "חריץ" (slot) הוא מקום בין שני שירים:
// חריץ 0 = לפני השיר הראשון, חריץ years.length = אחרי השיר האחרון.

/** האם השיר עם השנה year שמוקם בחריץ slot נמצא במקום הנכון? שנה זהה לשכן נחשבת נכונה. */
export function isPlacementCorrect(years: number[], slot: number, year: number): boolean {
  if (!Number.isInteger(slot) || slot < 0 || slot > years.length) return false
  const before = slot > 0 ? years[slot - 1] : undefined
  const after = slot < years.length ? years[slot] : undefined
  return (before === undefined || before <= year) && (after === undefined || year <= after)
}

/** כל החריצים הנכונים לשנה הזו (יכולים להיות כמה כשיש שנים זהות) */
export function correctSlots(years: number[], year: number): number[] {
  const slots: number[] = []
  for (let i = 0; i <= years.length; i++) if (isPlacementCorrect(years, i, year)) slots.push(i)
  return slots
}

/** מכניס פריט לציר ממוין לפי שנה, במקום הנכון הראשון */
export function insertByYear<T extends { year: number }>(timeline: T[], item: T): T[] {
  const slot = correctSlots(timeline.map((t) => t.year), item.year)[0] ?? timeline.length
  return [...timeline.slice(0, slot), item, ...timeline.slice(slot)]
}
