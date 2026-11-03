import type { Formula } from '../data/types'
import { ratioTopics } from '../data/formulas'

/** תווית קצרה: הקיצור שבסוגריים (NPV) או השם העברי */
export function shortLabel(f: Formula): string {
  const m = f.en.match(/\(([^()]{1,10})\)\s*$/)
  if (m && /^[A-Za-z/ .]+$/.test(m[1])) return m[1]
  if (/^[A-Z/ ]{2,10}$/.test(f.en)) return f.en
  return f.he
}

export const isRatio = (f: Formula) => ratioTopics.has(f.topic)
