import { useState } from 'react'
import { CATEGORY_LABELS, getScores, type ScoreCategory } from '../game/highscores'

const CATS: ScoreCategory[] = ['easy', 'medium', 'hard', 'playlists']

export function ScoreTable({ category, highlightDate }: { category: ScoreCategory; highlightDate?: string }) {
  const list = getScores(category)
  if (list.length === 0) return <p className="py-4 text-center text-violet-300">עוד אין תוצאות בטבלה הזו</p>
  return (
    <ol className="space-y-1">
      {list.map((e, i) => (
        <li
          key={e.date + i}
          className={`flex items-center gap-3 rounded-xl px-3 py-2 ${e.date === highlightDate ? 'bg-amber-400 font-bold text-black' : i === 0 ? 'bg-amber-500/20' : 'bg-white/5'}`}
        >
          <span className="w-7 text-center text-lg">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
          <span className="min-w-0 flex-1 truncate">{e.name}</span>
          <span className="text-xs opacity-70">{new Date(e.date).toLocaleDateString('he-IL')}</span>
          <span className="w-10 text-end text-xl font-black">{e.score}</span>
        </li>
      ))}
    </ol>
  )
}

export default function HighScores({ onBack, initial = 'medium' }: { onBack: () => void; initial?: ScoreCategory }) {
  const [cat, setCat] = useState<ScoreCategory>(initial)
  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-black">🏆 שיאי סולו</h1>
        <button onClick={onBack} className="rounded-lg bg-white/10 px-3 py-2">
          → חזרה
        </button>
      </header>
      <div className="grid grid-cols-2 gap-2">
        {CATS.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`rounded-xl py-2 text-sm ${cat === c ? 'bg-green-500 font-bold text-black' : 'bg-white/10'}`}>
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>
      <ScoreTable category={cat} />
    </main>
  )
}
