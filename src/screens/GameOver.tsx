import type { GameState } from '../game/game'
import Timeline from '../components/Timeline'

export default function GameOver({ game, onNewGame, onRematch }: { game: GameState; onNewGame: () => void; onRematch: () => void }) {
  const winner = game.winner !== null ? game.players[game.winner] : null
  const order = [...game.players].sort((a, b) => b.timeline.length - a.timeline.length)
  return (
    <main className="mx-auto max-w-md space-y-5 p-4 text-center">
      <div className="pop-in pt-6 text-8xl">🏆</div>
      <h1 className="text-4xl font-black">{winner ? `${winner.name} ניצח/ה!` : 'המשחק נגמר'}</h1>
      {winner && (
        <p className="text-violet-200">
          {winner.timeline.length} שירים בציר אחרי {game.turn} תורות
        </p>
      )}

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
