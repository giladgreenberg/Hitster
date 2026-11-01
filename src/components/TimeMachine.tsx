// "מכונת זמן": מונה שנים שמסתובב מהר ונעצר על השנה הנכונה.
import { useEffect, useState } from 'react'

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function TimeMachine({ year, run, className = '' }: { year: number; run: boolean; className?: string }) {
  const [shown, setShown] = useState<number>(year)
  const [spinning, setSpinning] = useState(false)

  useEffect(() => {
    if (!run || reducedMotion()) {
      setShown(year)
      return
    }
    // מתחילים מנקודה רחוקה (עשרות שנים מהשנה האמיתית) ומאטים עד שעוצרים עליה
    const from = year + (Math.random() < 0.5 ? -1 : 1) * (25 + Math.floor(Math.random() * 30))
    const delay = 450 // מחכים שהכרטיס יסיים להתהפך
    const duration = 1500
    let raf = 0
    const t0 = performance.now() + delay
    setShown(from)
    setSpinning(true)
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0) / duration))
      const eased = 1 - Math.pow(1 - p, 4) // מהר בהתחלה, לאט בסוף
      setShown(Math.round(from + (year - from) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
      else setSpinning(false)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [year, run])

  return (
    <span className={`inline-block tabular-nums ${spinning ? 'time-spin' : 'time-land'} ${className}`} aria-label={String(year)}>
      {shown}
    </span>
  )
}
