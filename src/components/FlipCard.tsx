// כרטיס השיר הנוכחי: גב סגור ("?") עד החשיפה, ואז מתהפך ומראה עטיפה, שם, אמן ושנה.
import type { Song } from '../songs/types'
import TimeMachine from './TimeMachine'
import YearFact from './YearFact'

interface Props {
  song: Song | null
  revealed: boolean
  /** true = ירוק, false = אדום, null = ניטרלי */
  correct: boolean | null
}

export default function FlipCard({ song, revealed, correct }: Props) {
  const ring = correct === null ? 'ring-violet-400' : correct ? 'ring-green-400' : 'ring-red-500'
  const bg = correct === null ? 'bg-indigo-900' : correct ? 'bg-green-600' : 'bg-red-700'
  return (
    <div className="space-y-3">
    <div className={`flip mx-auto h-72 w-56 ${revealed ? 'flipped' : ''}`}>
      <div className="flip-inner">
        {/* גב הכרטיס */}
        <div className="flip-face flex flex-col items-center justify-center rounded-3xl bg-gradient-to-br from-fuchsia-600 via-violet-700 to-indigo-800 shadow-2xl ring-4 ring-violet-400/40">
          <div className="text-8xl font-black text-white/90">?</div>
          <div className="mt-2 text-lg text-violet-100">איזו שנה?</div>
        </div>
        {/* פני הכרטיס */}
        <div className={`flip-face flip-back flex flex-col items-center gap-2 overflow-hidden rounded-3xl p-4 text-center shadow-2xl ring-4 ${ring} ${bg}`}>
          {song?.coverUrl ? (
            <img src={song.coverUrl} alt="" className="h-28 w-28 rounded-xl object-cover shadow-lg" />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-xl bg-black/20 text-5xl">🎵</div>
          )}
          <div className="text-6xl font-black leading-none">{song && <TimeMachine key={song.id} year={song.year} run={revealed} />}</div>
          <div className="line-clamp-2 text-lg font-bold leading-tight">{song?.name}</div>
          <div className="line-clamp-1 text-sm opacity-90">{song?.artists}</div>
        </div>
      </div>
    </div>
    {revealed && song && <YearFact year={song.year} seed={song.id} />}
    </div>
  )
}
