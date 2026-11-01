// לבבות של קבוצה באקסטרים
import { EXTREME_LIVES } from '../game/modes'

export default function Lives({ lives, size = 'text-2xl' }: { lives: number; size?: string }) {
  return (
    <span className={`inline-flex gap-0.5 ${size}`} aria-label={`${lives} מתוך ${EXTREME_LIVES} לבבות`}>
      {Array.from({ length: EXTREME_LIVES }, (_, i) => (
        <span key={i} className={i < lives ? 'pop-in' : 'opacity-25 grayscale'}>
          {i < lives ? '❤️' : '🖤'}
        </span>
      ))}
    </span>
  )
}
