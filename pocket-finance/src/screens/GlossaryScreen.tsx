import { useMemo, useRef, useState } from 'react'
import { formulaById } from '../data/formulas'
import { terms } from '../data/glossary'
import { CloseIcon, SearchIcon, StarIcon } from '../components/Icons'
import { Bidi } from '../components/Tex'
import { shortLabel } from '../lib/labels'
import { matches } from '../lib/search'
import { useStore } from '../lib/store'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export function GlossaryScreen({ hidden, onOpenTerm, onOpenFormula }: { hidden: boolean; onOpenTerm: (id: string) => void; onOpenFormula: (id: string) => void }) {
  const { isFav, toggleFav } = useStore()
  const [q, setQ] = useState('')
  const [cur, setCur] = useState<string | null>(null)
  const scroller = useRef<HTMLElement>(null)

  const list = useMemo(() => terms.filter((t) => matches(q, t.en, t.he, t.short, t.id)), [q])
  const sections = useMemo(() => {
    const m = new Map<string, typeof terms>()
    for (const t of list) {
      const L = t.en[0].toUpperCase()
      if (!m.has(L)) m.set(L, [])
      m.get(L)!.push(t)
    }
    return m
  }, [list])

  const jump = (L: string) => {
    // אם אין מושגים באות – קופצים לאות הקרובה הבאה (או הקודמת)
    const idx = LETTERS.indexOf(L)
    const target = LETTERS.slice(idx).find((x) => sections.has(x)) ?? [...LETTERS.slice(0, idx)].reverse().find((x) => sections.has(x))
    if (!target) return
    setCur(L)
    const el = document.getElementById('gl-' + target)
    const sc = scroller.current
    if (el && sc) sc.scrollTo({ top: el.offsetTop - 8, behavior: 'auto' })
  }

  const railPick = (e: React.PointerEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
    const L = el?.dataset?.letter
    if (L && L !== cur) jump(L)
  }

  return (
    <main className="screen gl-screen" hidden={hidden} ref={scroller}>
      <div className="screen-inner">
        <div className="search">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש מושג באנגלית או בעברית…" aria-label="חיפוש מושג" enterKeyHint="search" />
          {q ? (
            <button className="clear" onClick={() => setQ('')} aria-label="ניקוי חיפוש">
              <CloseIcon size={18} />
            </button>
          ) : (
            <SearchIcon />
          )}
        </div>

        {list.length === 0 && (
          <div className="empty">
            <span className="big">🔍</span>לא נמצאו מושגים
          </div>
        )}

        <div style={{ position: 'relative' }}>
          {[...sections.entries()].map(([L, items]) => (
            <section key={L}>
              <div className="letter" id={'gl-' + L}>
                {L}
              </div>
              {items.map((t) => {
                const fav = isFav('t:' + t.id)
                const f = t.formula ? formulaById[t.formula] : undefined
                return (
                  <div className="card term" key={t.id} role="button" tabIndex={0} onClick={() => onOpenTerm(t.id)} onKeyDown={(e) => e.key === 'Enter' && onOpenTerm(t.id)}>
                    <div className="term-top">
                      <span className="he">{t.he}</span>
                      <span className="en" dir="ltr">
                        {t.en}
                      </span>
                    </div>
                    <div className="term-bot">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="short"><Bidi text={t.short} /></div>
                        {f && (
                          <button
                            className="flink"
                            onClick={(e) => {
                              e.stopPropagation()
                              onOpenFormula(f.id)
                            }}
                          >
                            נוסחת {shortLabel(f)} ←
                          </button>
                        )}
                      </div>
                      <button
                        className={'star' + (fav ? ' on' : '')}
                        style={{ margin: '-6px -8px -8px -6px' }}
                        aria-label={fav ? 'הסרה מ"לזכור"' : 'סימון "לזכור"'}
                        aria-pressed={fav}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleFav('t:' + t.id)
                        }}
                      >
                        <StarIcon filled={fav} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </section>
          ))}
        </div>
        <p className="note" style={{ textAlign: 'center', marginTop: 16 }}>
          {terms.length} מושגים במילון
        </p>
      </div>

      <nav
        className="rail"
        aria-label="קפיצה לאות"
        onPointerDown={(e) => {
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
          railPick(e)
        }}
        onPointerMove={(e) => e.buttons && railPick(e)}
        onPointerUp={() => setCur(null)}
      >
        {LETTERS.map((L) => (
          <button key={L} data-letter={L} className={(sections.has(L) ? '' : 'dim') + (cur === L ? ' cur' : '')} onClick={() => jump(L)} aria-label={`אות ${L}`}>
            {L}
          </button>
        ))}
      </nav>
    </main>
  )
}
