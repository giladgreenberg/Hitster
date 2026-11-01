// רמת קושי במצב "אקראי".
// שדה ה-popularity הוסר מ-Spotify במצב Development, אז משלבים שני סימנים אחרים:
// 1. עומק בתוצאות החיפוש – ספוטיפיי עדיין מדרג תוצאות בעיקר לפי פופולריות.
// 2. מספר ההוצאות ב-MusicBrainz – להיט יוצא בהרבה אוספים והוצאות; שיר נידח – במעט.
import type { Difficulty } from '../game/modes'

export const EASY_MIN_RELEASES = 6
export const HARD_MAX_RELEASES = 4

const MAX_OFFSET = 1000 // מגבלה של ספוטיפיי
const PAGE = 10 // מגבלה של ספוטיפיי במצב Development

/** טווח ה-offset שממנו מגרילים, לפי הקושי וכמות התוצאות. מחזיר [מינימום, מקסימום] כולל. */
export function offsetRange(difficulty: Difficulty, total: number): [number, number] {
  const last = Math.max(0, Math.min(total, MAX_OFFSET) - PAGE)
  if (difficulty === 'easy') return [0, Math.min(last, 50 - PAGE)]
  if (difficulty === 'medium') return [0, Math.min(last, 300 - PAGE)]
  // קשה: מהחלק העמוק של התוצאות (אם יש מעט תוצאות – מהחצי השני שלהן)
  const from = Math.min(300, Math.floor(total / 2))
  return [Math.min(from, last), last]
}

/** האם שיר מתאים לרמת הקושי לפי מספר ההוצאות שלו ב-MusicBrainz */
export function passesDifficulty(difficulty: Difficulty | undefined, releases: number | null | undefined): boolean {
  if (difficulty === 'easy') return releases != null && releases >= EASY_MIN_RELEASES
  if (difficulty === 'hard') return releases == null || releases <= HARD_MAX_RELEASES
  return true
}
