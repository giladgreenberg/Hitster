// ציר הזמן: אופקי עם גלילה. השיר המוקדם ביותר מימין (כיוון קריאה בעברית).
// בין כל שני שירים יש "חריץ" שאפשר ללחוץ עליו כדי למקם את השיר החדש.
// לצירים ארוכים (אקסטרים): מצב "זום מוקטן" (רק שנים) ופס עשורים לקפיצה מהירה.
import { useEffect, useRef, useState } from 'react'
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
  /** כלים לציר ארוך: זום + פס עשורים (מופיעים כשיש הרבה שירים) */
  longTools?: boolean
}

type Size = 'normal' | 'compact' | 'mini'

const CARD: Record<Size, string> = { normal: 'h-36 w-28', compact: 'h-28 w-24', mini: 'h-20 w-14' }
const SLOT_H: Record<Size, string> = { normal: 'h-36', compact: 'h-28', mini: 'h-20' }

export function SongCard({ song, highlight, compact, size }: { song: Song; highlight?: boolean; compact?: boolean; size?: Size }) {
  const sz: Size = size ?? (compact ? 'compact' : 'normal')
  const bg = highlight ? 'pop-in bg-green-500 text-black' : 'bg-gradient-to-b from-violet-700 to-indigo-900'
  if (sz === 'mini') {
    return (
      <div className={`flex shrink-0 flex-col items-center justify-center rounded-lg p-1 text-center shadow ${CARD.mini} ${bg}`} title={`${song.name} – ${song.artists}`}>
        <div className="text-base font-black leading-none">{song.year}</div>
        <div className={`mt-1 line-clamp-2 text-[9px] leading-tight ${highlight ? '' : 'text-violet-200'}`}>{song.name}</div>
      </div>
    )
  }
  return (
    <div className={`flex shrink-0 flex-col items-center justify-between rounded-xl p-2 text-center shadow-lg ${CARD[sz]} ${bg}`}>
      <div className={`line-clamp-2 text-xs font-semibold leading-tight ${highlight ? '' : 'text-violet-100'}`}>{song.name}</div>
      <div className={`${sz === 'compact' ? 'text-2xl' : 'text-3xl'} font-black`}>{song.year}</div>
      <div className={`line-clamp-2 text-[11px] leading-tight ${highlight ? '' : 'text-violet-300'}`}>{song.artists}</div>
    </div>
  )
}

function Slot({ index, selected, onSelect, locked, mark = '?', size }: { index: number; selected: boolean; onSelect?: (i: number) => void; locked?: string; mark?: string; size: Size }) {
  const h = SLOT_H[size]
  const wide = size === 'mini' ? 'w-14' : 'w-24'
  if (locked !== undefined) {
    return (
      <div data-slot={index} className={`flex ${h} ${wide} shrink-0 flex-col items-center justify-center rounded-xl border-2 border-violet-300/60 bg-violet-900/60 text-center`}>
        <span className={`${size === 'mini' ? 'text-xl' : 'text-4xl'} font-black`}>?</span>
        <span className="line-clamp-2 px-1 text-xs text-violet-200">{locked}</span>
      </div>
    )
  }
  if (selected) {
    return (
      <button
        data-slot={index}
        onClick={() => onSelect?.(index)}
        className={`pulse-ring flex ${h} ${wide} shrink-0 items-center justify-center rounded-xl border-2 border-violet-300 bg-violet-500/40 ${size === 'mini' ? 'text-2xl' : 'text-5xl'} font-black`}
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
      className={`flex ${h} ${size === 'mini' ? 'w-8' : 'w-11'} shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-violet-400/50 text-2xl text-violet-300 active:bg-violet-500/30`}
      aria-label={`מקם כאן (מקום ${index + 1})`}
    >
      +
    </button>
  )
}

const decadeOf = (y: number) => Math.floor(y / 10) * 10
const decadeLabel = (d: number) => (d >= 2000 ? `${d}` : `שנות ה-${d % 100}`)

export default function Timeline({
  timeline, selectable, selectedSlot = null, onSelect, highlightId, compact, lockedSlot = null, lockedLabel = '', selectedMark, longTools,
}: Props) {
  const long = !!longTools && timeline.length >= 8
  const [zoomOut, setZoomOut] = useState<boolean | null>(null)
  // ברירת מחדל: מעל 15 שירים עוברים אוטומטית לתצוגה מוקטנת
  const mini = long && (zoomOut ?? timeline.length > 15)
  const size: Size = mini ? 'mini' : compact ? 'compact' : 'normal'

  const scroller = useRef<HTMLDivElement>(null)

  // גוללים אוטומטית לחריץ שנבחר / לשיר המודגש
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const target = el.querySelector<HTMLElement>(
      selectedSlot !== null
        ? `[data-slot="${selectedSlot}"]`
        : highlightId
          ? `[data-song="${highlightId}"]`
          : lockedSlot !== null
            ? `[data-slot="${lockedSlot}"]`
            : 'none',
    )
    target?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [selectedSlot, highlightId, lockedSlot, mini])

  const jumpToDecade = (d: number) => {
    scroller.current?.querySelector<HTMLElement>(`[data-decade="${d}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }

  const slot = (i: number, key: string) => (
    <Slot key={key} index={i} selected={selectedSlot === i} onSelect={onSelect} locked={lockedSlot === i ? lockedLabel : undefined} mark={selectedMark} size={size} />
  )

  const items: React.ReactNode[] = []
  let lastDecade: number | null = null
  timeline.forEach((song, i) => {
    if (selectable || lockedSlot === i) items.push(slot(i, `s${i}`))
    const d = decadeOf(song.year)
    const firstOfDecade = d !== lastDecade
    lastDecade = d
    items.push(
      <div key={song.id} data-song={song.id} data-decade={firstOfDecade ? d : undefined} className="relative">
        {long && firstOfDecade && <span className="absolute -top-3 right-0 whitespace-nowrap text-[10px] font-bold text-amber-300">{d}s</span>}
        <SongCard song={song} highlight={song.id === highlightId} size={size} />
      </div>,
    )
  })
  if (selectable || lockedSlot === timeline.length) items.push(slot(timeline.length, 'slast'))

  const decades = [...new Set(timeline.map((s) => decadeOf(s.year)))]

  return (
    <div>
      {!compact && (
        <div className="mb-1 flex items-center justify-between gap-2 px-1 text-xs text-violet-400">
          <span>→ מוקדם</span>
          {long && (
            <button onClick={() => setZoomOut(!mini)} className="rounded-full bg-white/10 px-3 py-1 text-violet-100">
              {mini ? '🔍 הגדלה' : '🔎 הקטנה'} ({timeline.length} שירים)
            </button>
          )}
          <span>מאוחר ←</span>
        </div>
      )}
      {long && decades.length > 1 && (
        <div className="no-scrollbar flex gap-1 overflow-x-auto px-1 pb-1">
          {decades.map((d) => (
            <button key={d} onClick={() => jumpToDecade(d)} className="shrink-0 rounded-full bg-amber-500/20 px-3 py-1 text-xs text-amber-100">
              {decadeLabel(d)}
            </button>
          ))}
        </div>
      )}
      <div ref={scroller} className={`no-scrollbar flex items-center overflow-x-auto px-2 ${mini ? 'gap-1 py-4' : 'gap-2 py-3'}`}>
        {items}
      </div>
    </div>
  )
}
