// עובדה קצרה ומעניינת על השנה (מתוך src/data/yearFacts.json)
import { useMemo } from 'react'
import facts from '../data/yearFacts.json'

const FACTS = facts as Record<string, string[]>

export function factsFor(year: number): string[] {
  return FACTS[String(year)] ?? []
}

export default function YearFact({ year, seed }: { year: number; seed: string }) {
  // אותו שיר = אותה עובדה (גם אחרי רענון), שירים שונים = עובדות שונות
  const fact = useMemo(() => {
    const list = factsFor(year)
    if (!list.length) return null
    let h = 0
    for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
    return list[h % list.length]
  }, [year, seed])
  if (!fact) return null
  return (
    <div className="fact-in mx-auto max-w-xs rounded-2xl bg-white/5 px-4 py-2 text-center text-sm text-violet-100">
      <span className="font-bold text-amber-300">📅 ב-{year}:</span> {fact}
    </div>
  )
}
