// פודיום מנצחים: המקומות נחשפים בדרמטיות – שלישי, שני, ואז ראשון עם קונפטי ומוזיקה.
import { useEffect, useState } from 'react'
import Confetti from './Confetti'
import { playFanfare } from '../sound/fanfare'

export interface PodiumEntry {
  name: string
  /** הטקסט הגדול (למשל "🎵 10") */
  score: string
  /** שורה קטנה מתחת (למשל "🪙 3") */
  sub?: string
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// סגנון מקורי: עמודות בצבעי זריחה (ענבר, טורקיז, סגול)
const STYLE = [
  { medal: '🥇', h: 'h-44', bg: 'from-amber-300 to-orange-500', text: 'text-black' },
  { medal: '🥈', h: 'h-32', bg: 'from-teal-300 to-cyan-600', text: 'text-black' },
  { medal: '🥉', h: 'h-24', bg: 'from-fuchsia-400 to-violet-700', text: 'text-white' },
]

export default function Podium({ entries, onDone }: { entries: PodiumEntry[]; onDone?: () => void }) {
  const top = entries.slice(0, 3)
  // כמה מקומות כבר נחשפו (מהאחרון לראשון)
  const [shown, setShown] = useState(() => (reducedMotion() ? top.length : 0))

  useEffect(() => {
    if (shown >= top.length) return
    const t = setTimeout(() => setShown((s) => s + 1), shown === 0 ? 700 : shown === top.length - 1 ? 1500 : 1100)
    return () => clearTimeout(t)
  }, [shown, top.length])

  const allIn = shown >= top.length
  useEffect(() => {
    if (!allIn) return
    playFanfare()
    onDone?.()
  }, [allIn])

  // סדר תצוגה: שני – ראשון – שלישי (הראשון באמצע וגבוה)
  const order = top.length === 3 ? [1, 0, 2] : top.length === 2 ? [1, 0] : [0]
  const isShown = (rank: number) => shown >= top.length - rank

  return (
    <div className="relative">
      {allIn && <Confetti count={140} />}
      <div dir="ltr" className="flex items-end justify-center gap-2 pt-24">
        {order.map((rank) => {
          const e = top[rank]
          const st = STYLE[rank]
          const visible = isShown(rank)
          return (
            <div key={rank} className="flex w-28 flex-col items-center">
              <div className={`mb-2 text-center transition-all duration-500 ${visible ? 'podium-in' : 'opacity-0'}`} dir="rtl">
                <div className="text-4xl">{st.medal}</div>
                <div className="line-clamp-2 text-lg font-black leading-tight">{e.name}</div>
                <div className="text-sm text-violet-200">{e.score}</div>
                {e.sub && <div className="text-xs text-violet-300">{e.sub}</div>}
              </div>
              <div
                className={`flex w-full items-start justify-center rounded-t-2xl bg-gradient-to-b pt-2 text-4xl font-black shadow-xl ${st.bg} ${st.text} podium-rise ${st.h}`}
                style={{ animationDelay: `${(top.length - 1 - rank) * 0.15}s` }}
              >
                {rank + 1}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
