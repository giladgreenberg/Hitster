export type Tone = 'good' | 'ok' | 'bad' | 'info'

export interface Topic {
  id: string
  /** שם מלא לכותרת */
  name: string
  /** שם קצר לצ'יפ */
  short: string
}

export interface Formula {
  id: string
  topic: string
  /** שם באנגלית, כפי שמוצג בכרטיס */
  en: string
  /** שם בעברית */
  he: string
  /** הנוסחה המלאה ב-TeX */
  tex: string
  /** גרסה מקוצרת לכרטיס ברשימה (אם הנוסחה המלאה ארוכה) */
  cardTex?: string
  /** מילות חיפוש נוספות (עברית/אנגלית) */
  keywords?: string[]
  /** הסבר משתנים: [סמל ב-TeX, הסבר בעברית] */
  vars: [string, string][]
  /** "מה זה אומר" */
  meaning: string
  /** "איך לפרש" */
  interpret: {
    levels?: { tone: Tone; text: string }[]
    rules?: string[]
    note?: string
  }
  /** תג קטן בכרטיס, למשל "טוב: 1.5–2" */
  goodRange?: string
  /** דוגמה פתורה. values הם גם ערכי ברירת המחדל במחשבון; result הוא הערך שהמחשבון אמור להחזיר */
  example: {
    text: string
    values: Record<string, string | number>
    result: number
  }
  mistakes: string[]
  tip: string
}

export interface Term {
  id: string
  en: string
  he: string
  /** שורת הסבר קצרה */
  short: string
  /** הסבר מלא */
  full: string
  example?: string
  /** מזהים של מושגים קשורים */
  related?: string[]
  /** מזהה נוסחה מקושרת */
  formula?: string
}
