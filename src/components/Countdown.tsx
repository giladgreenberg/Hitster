// שעון עצר גלוי: פס שמתרוקן + שניות. קורא ל-onExpire פעם אחת כשהזמן נגמר.
import { useEffect, useRef, useState } from 'react'

interface Props {
  /** מתי השעון התחיל (null = עוד לא התחיל – מחכים שהשיר יתחיל) */
  startedAt: number | null
  seconds: number
  onExpire: () => void
  /** עוצרים את השעון (למשל בזמן חשיפה) */
  paused?: boolean
}

export default function Countdown({ startedAt, seconds, onExpire, paused }: Props) {
  const [now, setNow] = useState(Date.now())
  const fired = useRef(false)

  useEffect(() => {
    fired.current = false
  }, [startedAt])

  useEffect(() => {
    if (startedAt === null || paused) return
    const t = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(t)
  }, [startedAt, paused])

  const total = seconds * 1000
  const left = startedAt === null ? total : Math.max(0, startedAt + total - now)

  useEffect(() => {
    if (startedAt !== null && !paused && left <= 0 && !fired.current) {
      fired.current = true
      onExpire()
    }
  }, [left, startedAt, paused, onExpire])

  const pct = (left / total) * 100
  const urgent = left <= 5000
  return (
    <div className="space-y-1" aria-live="polite">
      <div className="flex items-center justify-between text-sm">
        <span className="text-violet-300">{startedAt === null ? '⏳ השעון יתחיל כשהשיר יתחיל' : '⏱️ זמן למקם'}</span>
        <span className={`text-2xl font-black tabular-nums ${urgent ? 'text-red-400' : ''}`}>{Math.ceil(left / 1000)}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-[width] duration-100 ease-linear ${urgent ? 'bg-red-500' : 'bg-green-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
