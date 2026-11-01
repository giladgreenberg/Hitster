import type { Playback } from '../playback/usePlayback'

export default function PlayerControls({ playback, onPlay }: { playback: Playback; onPlay: () => void }) {
  const { isPlaying, busy, pause, resume, restart, hasSong } = playback
  const big = 'flex-1 rounded-2xl py-4 text-xl font-bold active:scale-95 disabled:opacity-40'
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {!hasSong() ? (
          <button disabled={busy} onClick={onPlay} className={`${big} bg-green-500 text-black`}>
            ▶ נגן
          </button>
        ) : isPlaying ? (
          <button disabled={busy} onClick={pause} className={`${big} bg-white/15`}>
            ⏸ השהה
          </button>
        ) : (
          <button disabled={busy} onClick={resume} className={`${big} bg-green-500 text-black`}>
            ▶ המשך
          </button>
        )}
        <button disabled={busy || !hasSong()} onClick={restart} className={`${big} bg-white/15`}>
          ⏮ מההתחלה
        </button>
      </div>
      {playback.status && <p className="text-sm text-violet-300">{playback.status}</p>}
      {playback.error && <p className="rounded-xl bg-red-500/20 p-3 text-red-200">{playback.error}</p>}
    </div>
  )
}
