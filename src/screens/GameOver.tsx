// סוף משחק קלאסי: פודיום ← סטטיסטיקות ← הצירים של כולם
import { useState } from 'react'
import type { GameState } from '../game/game'
import Timeline from '../components/Timeline'
import Podium from '../components/Podium'
import StatsPanel from '../components/StatsPanel'

export default function GameOver({ game, onNewGame, onRematch }: { game: GameState; onNewGame: () => void; onRematch: () => void }) {
  const [step, setStep] = useState<'podium' | 'stats'>('podium')
  const [podiumDone, setPodiumDone] = useState(false)
  const winner = game.winner !== null ? game.players[game.winner] : null
  // דירוג: המנצח קודם, אחר כך לפי מספר השירים, ואז לפי אסימונים
  const order = [...game.players].sort(
    (a, b) => Number(b === winner) - Number(a === winner) || b.timeline.length - a.timeline.length || b.tokens - a.tokens,
  )

  if (step === 'podium') {
    return (
      <main className="mx-auto flex min-h-full max-w-md flex-col gap-6 p-4 text-center">
        <h1 className="pt-4 text-3xl font-black">{winner ? `${winner.name} ניצח/ה! 🏆` : 'המשחק נגמר'}</h1>
        <Podium
          entries={order.map((p) => ({ name: p.name, score: `🎵 ${p.timeline.length} שירים`, sub: game.settings.guessBonus ? `🪙 ${p.tokens}` : undefined }))}
          onDone={() => setPodiumDone(true)}
        />
        {order.length > 3 && (
          <ol className="space-y-1 text-start" start={4}>
            {order.slice(3).map((p, i) => (
              <li key={i} className="flex justify-between rounded-xl bg-white/5 px-3 py-2">
                <span>
                  {i + 4}. {p.name}
                </span>
                <span>🎵 {p.timeline.length}</span>
              </li>
            ))}
          </ol>
        )}
        <button
          onClick={() => setStep('stats')}
          className={`mt-auto w-full rounded-2xl bg-violet-500 py-4 text-2xl font-black transition-opacity active:scale-95 ${podiumDone ? '' : 'opacity-0'}`}
          disabled={!podiumDone}
        >
          📊 לסטטיסטיקות
        </button>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-md space-y-5 p-4 text-center">
      <h1 className="pt-4 text-3xl font-black">📊 סיכום המשחק</h1>
      <StatsPanel events={game.events ?? []} actors={game.players.map((p) => p.name)} />

      <div className="space-y-3 text-start">
        {order.map((p, i) => (
          <div key={i} className={`rounded-2xl p-3 ${p === winner ? 'bg-green-500/20 ring-2 ring-green-400' : 'bg-white/5'}`}>
            <div className="flex justify-between text-lg font-bold">
              <span>
                {i + 1}. {p.name}
              </span>
              <span>🎵 {p.timeline.length}</span>
            </div>
            <Timeline timeline={p.timeline} compact />
          </div>
        ))}
      </div>

      <button onClick={onRematch} className="w-full rounded-2xl bg-green-500 py-4 text-2xl font-black text-black active:scale-95">
        🔁 עוד משחק (אותן הגדרות)
      </button>
      <button onClick={onNewGame} className="w-full rounded-2xl bg-white/10 py-4 text-xl">
        ⚙️ שינוי הגדרות
      </button>
    </main>
  )
}
