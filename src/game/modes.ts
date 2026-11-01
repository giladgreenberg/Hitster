// מצבי המשחק, רמות קושי וברירות מחדל להגדרות החדשות.

export type GameMode = 'classic' | 'solo' | 'extreme'
export type Difficulty = 'easy' | 'medium' | 'hard'

export const MODES: { id: GameMode; emoji: string; title: string; desc: string }[] = [
  { id: 'classic', emoji: '🎵', title: 'קלאסי', desc: '2–8 שחקנים, לכל אחד ציר משלו. הראשון שמגיע ליעד מנצח. עם אסימונים ואתגרים.' },
  { id: 'solo', emoji: '⏱️', title: 'סולו', desc: 'לבד מול השעון. כמה שירים תסדרו ברצף? הטעות הראשונה מסיימת. יש טבלת שיאים.' },
  { id: 'extreme', emoji: '🔥', title: 'אקסטרים (קבוצות)', desc: 'שתי קבוצות על ציר משותף שרק מתארך. לכל קבוצה 3 לבבות – מי שנגמרים לה, מפסידה.' },
]

export const DIFFICULTIES: { id: Difficulty; title: string; desc: string }[] = [
  { id: 'easy', title: 'קל', desc: 'להיטים גדולים ומוכרים' },
  { id: 'medium', title: 'בינוני', desc: 'שילוב של מוכרים ופחות' },
  { id: 'hard', title: 'קשה', desc: 'שירים פחות מוכרים' },
]

export const SOLO_SECONDS_OPTIONS = [15, 30, 45, 60]
export const DEFAULT_SOLO_SECONDS = 30
/** אורך הקטע כשמפעילים "השמעת קטע בלבד" */
export const CLIP_SECONDS = 20
export const EXTREME_LIVES = 3
