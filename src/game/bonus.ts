// ניחוש שנה מדויקת.
// הבונוס ניתן רק אם המיקום בציר נכון (המיקום הוא העיקר) – את זה בודקים המצבים עצמם.

/** האם הניחוש קלע בדיוק לשנה */
export function exactYearHit(guess: number | null | undefined, year: number): boolean {
  return typeof guess === 'number' && Number.isInteger(guess) && guess === year
}

/** מפרש את מה שהוקלד בשדה (רק שנה בת 4 ספרות סבירה) */
export function parseYearGuess(text: string): number | null {
  const t = text.trim()
  if (!/^\d{4}$/.test(t)) return null
  const y = Number(t)
  return y >= 1900 && y <= new Date().getFullYear() + 1 ? y : null
}
