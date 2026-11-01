// ציר הזמן: אופקי עם גלילה. השיר המוקדם ביותר מימין (כיוון קריאה בעברית).
// בין כל שני שירים יש "חריץ" שאפשר ללחוץ עליו כדי למקם את השיר החדש.
import { useEffect, useRef } from 'react'
import type { Song } from '../songs/types'

interface Props {
  timeline: Song[]
  /** אפשר לבחור חריץ */
  selectable?: boolean
  selectedSlot?: number | null
  onSelect?: (slot: number) => void
  /** שיר להדגשה (למשל השיר שנכנס עכשיו) */
  highlightId?: string | null
  compact?: boolean
  /** חריץ תפוס (הבחירה של השחקן שבתור, בזמן אתגר) */
  lockedSlot?: number | null
  lockedLabel?: string
  /** הסימן בחריץ הנבחר */
  selectedMark?: string
}

export function SongCard({ song, highlight, compact }: { song: Song; highlight?: boolean; compact?: boolean }) {
  return (
    <div
      className={`flex shrink-0 flex-col items-center justify-between rounded-xl p-2 text-center shadow-lg ${
        compact ? 'h-28 w-24' : 'h-36 w-28'
      } ${highlight ? 'pop-in bg-green-500 text-black' : 'bg-gradient-to-b from-violet-700 to-indigo-900'}`}
    >
      <div className={`line-clamp-2 text-xs font-semibold leading-tight ${highlight ? '' : 'text-violet-100'}`}>{song.name}</div>
      <div className={`${compact ? 'text-2xl' : 'text-3xl'} font-black`}>{song.year}</div>
      <div className={`line-clamp-2 text-[11px] leading-tight ${highlight ? '' : 'text-violet-300'}`}>{song.artists}</div>
    </div>
  )
}

function Slot({ index, selected, onSelect, locked, mark = '?' }: { index: number; selected: boolean; onSelect?: (i: number) => void; locked?: string; mark?: string }) {
  if (locked !== undefined) {
    return (
      <div data-slot={index} className="flex h-36 w-24 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-violet-300/60 bg-violet-900/60 text-center">
        <span className="text-4xl font-black">?</span>
        <span className="line-clamp-2 px-1 text-xs text-violet-200">{locked}</span>
      </div>
    )
  }
  if (selected) {
    return (
      <button
        data-slot={index}
        onClick={() => onSelect?.(index)}
        className="pulse-ring flex h-36 w-24 shrink-0 items-center justify-center rounded-xl border-2 border-violet-300 bg-violet-500/40 text-5xl font-black"
        aria-label="המיקום שנבחר"
      >
        {mark}
      </button>
    )
  }
  return (
    <button
      data-slot={index}
      onClick={() => onSelect?.(index)}
      className="flex h-36 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-violet-400/50 text-2xl text-violet-300 active:bg-violet-500/30"
      aria-label={`מקם כאן (מקום ${index + 1})`}
    >
      +
    </button>
  )
}

export default function Timeline({ timeline, selectable, selectedSlot = null, onSelect, highlightId, compact, lockedSlot = null, lockedLabel = '', selectedMark }: Props) {
  const slot = (i: number, key: string) => (
    <Slot key={key} index={i} selected={selectedSlot === i} onSelect={onSelect} locked={lockedSlot === i ? lockedLabel : undefined} mark={selectedMark} />
  )
  const scroller = useRef<HTMLDivElement>(null)

  // גוללים אוטומטית לחריץ שנבחר / לשיר המודגש
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const target = el.querySelector<HTMLElement>(
      selectedSlot !== null ? `[data-slot="${selectedSlot}"]` : highlightId ? `[data-song="${highlightId}"]` : 'none',
    )
    target?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [selectedSlot, highlightId])

  const items: React.ReactNode[] = []
  timeline.forEach((song, i) => {
    if (selectable || lockedSlot === i) items.push(slot(i, `s${i}`))
    items.push(
      <div key={song.id} data-song={song.id}>
        <SongCard song={song} highlight={song.id === highlightId} compact={compact} />
      </div>,
    )
  })
  if (selectable || lockedSlot === timeline.length) items.push(slot(timeline.length, 'slast'))

  return (
    <div>
      {!compact && (
        <div className="mb-1 flex justify-between px-1 text-xs text-violet-400">
          <span>→ מוקדם</span>
          <span>מאוחר ←</span>
        </div>
      )}
      <div ref={scroller} className="no-scrollbar flex items-center gap-2 overflow-x-auto px-2 py-3">
        {items}
      </div>
    </div>
  )
}
