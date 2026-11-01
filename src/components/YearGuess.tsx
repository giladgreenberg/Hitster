// שדה אופציונלי לניחוש השנה המדויקת לפני החשיפה
import { parseYearGuess } from '../game/bonus'

interface Props {
  value: string
  onChange: (v: string) => void
  /** מה הבונוס במצב הזה (לטקסט ההסבר) */
  reward: string
}

export default function YearGuess({ value, onChange, reward }: Props) {
  const valid = value === '' || parseYearGuess(value) !== null
  return (
    <label className="flex items-center gap-3 rounded-2xl bg-amber-500/10 p-3">
      <span className="flex-1 text-sm leading-snug">
        <span className="block font-bold text-amber-200">🎯 יודעים את השנה המדויקת?</span>
        <span className="text-xs text-amber-100/70">לא חובה. קליעה + מיקום נכון = {reward}</span>
      </span>
      <input
        dir="ltr"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
        placeholder="שנה"
        className={`w-24 rounded-xl bg-white/10 p-3 text-center text-2xl font-black tabular-nums outline-none focus:ring-2 ${valid ? 'focus:ring-amber-400' : 'ring-2 ring-red-500'}`}
        aria-label="ניחוש השנה המדויקת"
      />
    </label>
  )
}

/** טקסט קצר שמראה בחשיפה מה ניחשו */
export function ExactGuessResult({ guess, year, hit, reward }: { guess: number | null | undefined; year: number; hit: boolean; reward: string }) {
  if (guess == null) return null
  if (hit) return <div className="pop-in rounded-2xl bg-amber-400 p-2 text-center text-lg font-black text-black">🎯 בול! {year} – {reward}</div>
  return (
    <div className="text-center text-sm text-violet-300">
      🎯 ניחשתם {guess}
      {guess === year ? ' – שנה מדויקת, אבל המיקום לא נכון, אז אין בונוס' : ` (הפרש של ${Math.abs(guess - year)} שנים)`}
    </div>
  )
}
