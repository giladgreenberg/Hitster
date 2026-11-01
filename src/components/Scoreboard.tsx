import type { GameState } from '../game/game'
import Timeline from './Timeline'

export default function Scoreboard({ game, onClose }: { game: GameState; onClose: () => void }) {
  const order = game.players.map((p, i) => ({ p, i })).sort((a, b) => b.p.timeline.length - a.p.timeline.length)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[#1a1333] p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">📊 לוח ניקוד</h2>
          <button onClick={onClose} className="rounded-full bg-white/10 px-4 py-2 text-lg">
            סגור
          </button>
        </div>
        <p className="mb-3 text-sm text-violet-300">
          תור {game.turn} · יעד: {game.settings.targetSongs} שירים
        </p>
        <div className="space-y-3">
          {order.map(({ p, i }) => (
            <div key={i} className={`rounded-2xl p-3 ${i === game.current ? 'bg-violet-600/40 ring-2 ring-violet-400' : 'bg-white/5'}`}>
              <div className="flex items-center justify-between text-lg">
                <span className="font-bold">
                  {i === game.current && '▶ '}
                  {p.name}
                </span>
                <span>
                  🎵 {p.timeline.length}/{game.settings.targetSongs}
                  {game.settings.guessBonus && <span className="ms-3">🪙 {p.tokens}</span>}
                </span>
              </div>
              <Timeline timeline={p.timeline} compact />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
