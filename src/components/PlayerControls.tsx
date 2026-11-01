import { useEffect, useState } from 'react'
import type { Playback } from '../playback/usePlayback'

/** פס שמתרוקן לאורך הקטע (במצב "השמעת קטע בלבד") */
function ClipBar({ playback }: { playback: Playback }) {
  const { clipMs, clipView } = playback
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!clipView?.endsAt) return
    const t = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(t)
  }, [clipView?.endsAt])
  if (!clipMs) return null
  const left = clipView ? (clipView.endsAt ? Math.max(0, clipView.endsAt - now) : clipView.remaining) : clipMs
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-violet-300">
        <span>🎧 קטע של {Math.round(clipMs / 1000)} שניות</span>
        <span className="tabular-nums">{Math.ceil(left / 1000)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-fuchsia-400 transition-[width] duration-100 ease-linear" style={{ width: `${(left / clipMs) * 100}%` }} />
      </div>
    </div>
  )
}

export default function PlayerControls({ playback, onPlay }: { playback: Playback; onPlay: () => void }) {
  const { isPlaying, busy, pause, resume, restart, hasSong, clipMs, clipView } = playback
  const big = 'flex-1 rounded-2xl py-4 text-xl font-bold active:scale-95 disabled:opacity-40'
  const clipDone = !!clipMs && clipView?.remaining === 0 && !clipView.endsAt
  return (
    <div className="space-y-2">
      <ClipBar playback={playback} />
      <div className="flex gap-2">
        {!hasSong() ? (
          <button disabled={busy} onClick={onPlay} className={`${big} bg-green-500 text-black`}>
            ▶ נגן
          </button>
        ) : clipDone ? (
          <button disabled={busy} onClick={restart} className={`${big} bg-green-500 text-black`}>
            🔁 נגן שוב את הקטע
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
        {!clipDone && (
          <button disabled={busy || !hasSong()} onClick={restart} className={`${big} bg-white/15`}>
            ⏮ מההתחלה
          </button>
        )}
      </div>
      {playback.status && <p className="text-sm text-violet-300">{playback.status}</p>}
      {playback.error && <p className="whitespace-pre-line rounded-xl bg-red-500/20 p-3 text-sm text-red-200">{playback.error}</p>}
    </div>
  )
}
