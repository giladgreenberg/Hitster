import { useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { formulaById, topicById } from '../data/formulas'
import { ArrowDown, ArrowUp, ChevronDown, CloseIcon, GripIcon } from '../components/Icons'
import { useStore } from '../lib/store'

interface Item {
  id: string
  label: string
  sub?: string
}

/** רשימה שאפשר לסדר בגרירה (ידית) או בחיצים */
function SortableList({ items, onChange, renderBelow, small }: { items: Item[]; onChange: (ids: string[]) => void; renderBelow?: (id: string) => ReactNode; small?: boolean }) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [order, setOrder] = useState<string[] | null>(null)
  const refs = useRef<Record<string, HTMLDivElement | null>>({})
  const drag = useRef<{ startY: number; ids: string[] } | null>(null)
  const ids = order ?? items.map((i) => i.id)
  const byId = Object.fromEntries(items.map((i) => [i.id, i]))

  const move = (from: number, to: number) => {
    if (to < 0 || to >= ids.length) return
    const next = [...ids]
    const [x] = next.splice(from, 1)
    next.splice(to, 0, x)
    onChange(next)
  }

  const onDown = (e: React.PointerEvent, id: string) => {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { startY: e.clientY, ids: items.map((i) => i.id) }
    setOrder(drag.current.ids)
    setDragId(id)
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || !dragId) return
    const el = refs.current[dragId]
    if (!el) return
    let dy = e.clientY - d.startY
    const idx = d.ids.indexOf(dragId)
    const gap = 8
    const next = d.ids[idx + 1] && refs.current[d.ids[idx + 1]]
    const prev = d.ids[idx - 1] && refs.current[d.ids[idx - 1]]
    if (next && dy > next.offsetHeight / 2 + gap) {
      const n = [...d.ids]
      ;[n[idx], n[idx + 1]] = [n[idx + 1], n[idx]]
      d.ids = n
      d.startY += next.offsetHeight + gap
      flushSync(() => setOrder(n))
    } else if (prev && dy < -(prev.offsetHeight / 2 + gap)) {
      const n = [...d.ids]
      ;[n[idx], n[idx - 1]] = [n[idx - 1], n[idx]]
      d.ids = n
      d.startY -= prev.offsetHeight + gap
      flushSync(() => setOrder(n))
    }
    dy = e.clientY - d.startY
    el.style.transform = `translateY(${dy}px)`
  }
  const onUp = () => {
    const d = drag.current
    if (dragId && refs.current[dragId]) refs.current[dragId]!.style.transform = ''
    if (d) onChange(d.ids)
    drag.current = null
    setDragId(null)
    setOrder(null)
  }

  return (
    <div>
      {ids.map((id, i) => (
        <div key={id}>
          <div className={'sort-row' + (dragId === id ? ' dragging' : '')} ref={(el) => void (refs.current[id] = el)} style={small ? { minHeight: 50 } : undefined}>
            <span className="grip" onPointerDown={(e) => onDown(e, id)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-hidden>
              <GripIcon />
            </span>
            <span className="lbl">
              {byId[id].label}
              {byId[id].sub && <small>{byId[id].sub}</small>}
            </span>
            <button className="iconbtn" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`הזזת ${byId[id].label} למעלה`}>
              <ArrowUp />
            </button>
            <button className="iconbtn" onClick={() => move(i, i + 1)} disabled={i === ids.length - 1} aria-label={`הזזת ${byId[id].label} למטה`}>
              <ArrowDown />
            </button>
          </div>
          {!dragId && renderBelow?.(id)}
        </div>
      ))}
    </div>
  )
}

export function TopicEditor({ onClose, onShowInstall }: { onClose: () => void; onShowInstall: () => void }) {
  const { s, set, orderedTopics, orderedFormulas } = useStore()
  const [open, setOpen] = useState<string | null>(null)
  const topics = orderedTopics()

  return (
    <div className="editor" role="dialog" aria-modal="true" aria-label="עריכת נושאים">
      <div className="editor-head">
        <h1>עריכת נושאים</h1>
        <button className="iconbtn" onClick={onClose} aria-label="סגירה">
          <CloseIcon />
        </button>
      </div>
      <div className="editor-body">
        <p className="ed-note">גררו בעזרת הידית ☰ או השתמשו בחיצים. לחיצה על "נוסחאות" פותחת את סדר הנוסחאות בתוך הנושא. הסדר נשמר במכשיר.</p>
        <SortableList
          items={topics.map((t) => ({ id: t, label: topicById[t].name }))}
          onChange={(ids) => set(() => ({ topicOrder: ids }))}
          renderBelow={(t) => (
            <>
              <button className="linkish" style={{ margin: '-4px 52px 8px 0' }} onClick={() => setOpen(open === t ? null : t)} aria-expanded={open === t}>
                {orderedFormulas(t).length} נוסחאות <ChevronDown size={16} style={{ transform: open === t ? 'rotate(180deg)' : undefined }} />
              </button>
              {open === t && (
                <div className="sub-list">
                  <SortableList small items={orderedFormulas(t).map((id) => ({ id, label: formulaById[id].he, sub: formulaById[id].en }))} onChange={(ids) => set((p) => ({ formulaOrder: { ...p.formulaOrder, [t]: ids } }))} />
                </div>
              )}
            </>
          )}
        />
        <button className="btn" style={{ width: '100%', marginTop: 14 }} onClick={() => set(() => ({ topicOrder: [], formulaOrder: {} }))}>
          איפוס לסדר המקורי
        </button>

        <div className="ed-sec">התקנה ונתונים</div>
        <button className="btn" style={{ width: '100%' }} onClick={onShowInstall}>
          איך מתקינים למסך הבית?
        </button>
        <p className="ed-note" style={{ marginTop: 12 }}>
          כל הנתונים שלכם ({s.favs.length} מסומנים, {s.learned.length} נלמדו, {Object.values(s.notes).filter(Boolean).length} הערות) נשמרים רק במכשיר הזה. האפליקציה עובדת גם בלי חיבור לאינטרנט.
        </p>
      </div>
    </div>
  )
}
