import { useEffect, useRef, useState } from 'react'
import { formulaById } from '../data/formulas'
import { termById } from '../data/glossary'
import { CloseIcon, SearchIcon, StarIcon } from '../components/Icons'
import { Bidi, FitTex } from '../components/Tex'
import { matches } from '../lib/search'
import { useStore } from '../lib/store'

type Filter = 'all' | 'f' | 't'

function StickyNote({ k }: { k: string }) {
  const { s, setNote } = useStore()
  const [edit, setEdit] = useState(false)
  const ta = useRef<HTMLTextAreaElement>(null)
  const text = s.notes[k] ?? ''
  useEffect(() => {
    if (edit && ta.current) {
      ta.current.focus()
      const n = ta.current.value.length
      ta.current.setSelectionRange(n, n)
    }
  }, [edit])
  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }
  return (
    <div className="sticky" onClick={() => setEdit(true)} role={edit ? undefined : 'button'} aria-label="הערה אישית – לחצו לעריכה">
      {edit ? (
        <textarea ref={ta} value={text} placeholder="כתבו הערה…" onChange={(e) => (setNote(k, e.target.value), grow(e.target))} onFocus={(e) => grow(e.target)} onBlur={() => setEdit(false)} aria-label="הערה אישית" />
      ) : text ? (
        <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>
      ) : (
        <span className="placeholder">+ הוסיפו הערה…</span>
      )}
    </div>
  )
}

function Doodles() {
  return (
    <div className="doodles" aria-hidden>
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="12" y="6" width="40" height="52" rx="5" transform="rotate(-12 32 32)" />
        <rect x="18" y="12" width="26" height="10" rx="2" transform="rotate(-12 32 32)" />
        {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={18 + c * 9} y={28 + r * 8} width="6" height="5" rx="1" transform="rotate(-12 32 32)" />))}
      </svg>
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="32" cy="32" r="24" />
        <path d="M32 32V8M32 32l18 14" />
      </svg>
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M8 58h50M12 58V42h8v16M26 58V34h8v16M40 58V24h8v34" />
        <path d="M10 34l14-10 12 4 18-16M48 12h6v6" />
      </svg>
    </div>
  )
}

export function FavoritesScreen({ hidden, onOpenFormula, onOpenTerm }: { hidden: boolean; onOpenFormula: (id: string) => void; onOpenTerm: (id: string) => void }) {
  const { s, toggleFav } = useStore()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const items = s.favs
    .filter((k) => (k.startsWith('f:') ? formulaById[k.slice(2)] : termById[k.slice(2)]))
    .filter((k) => filter === 'all' || k.startsWith(filter + ':'))
    .filter((k) => {
      const id = k.slice(2)
      const note = s.notes[k] ?? ''
      if (k.startsWith('f:')) {
        const f = formulaById[id]
        return matches(q, f.en, f.he, f.keywords ?? [], note)
      }
      const t = termById[id]
      return matches(q, t.en, t.he, t.short, note)
    })

  const total = s.favs.filter((k) => (k.startsWith('f:') ? formulaById[k.slice(2)] : termById[k.slice(2)])).length

  return (
    <main className="screen" hidden={hidden}>
      <div className="screen-inner">
        <div className="search">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש במסומנים…" aria-label="חיפוש במסומנים" enterKeyHint="search" />
          {q ? (
            <button className="clear" onClick={() => setQ('')} aria-label="ניקוי חיפוש">
              <CloseIcon size={18} />
            </button>
          ) : (
            <SearchIcon />
          )}
        </div>
        <div className="chips" aria-label="סינון">
          {(
            [
              ['all', 'הכל'],
              ['f', 'נוסחאות'],
              ['t', 'מושגים'],
            ] as [Filter, string][]
          ).map(([k, v]) => (
            <button key={k} className={'chip' + (filter === k ? ' active' : '')} style={{ minWidth: 92, justifyContent: 'center' }} onClick={() => setFilter(k)} aria-pressed={filter === k}>
              {v}
            </button>
          ))}
        </div>
        <div className="summary">
          <StarIcon size={17} filled style={{ color: 'var(--teal)', verticalAlign: -3 }} /> {total} פריטים מסומנים לזכור
        </div>

        {total === 0 && (
          <div className="empty">
            <span className="big">☆</span>
            עדיין לא סימנתם כלום.
            <br />
            לחצו על הכוכב ליד נוסחה או מושג, והוא יופיע כאן עם מקום להערה אישית.
          </div>
        )}
        {total > 0 && items.length === 0 && <div className="empty">אין תוצאות</div>}

        {items.map((k) => {
          const isF = k.startsWith('f:')
          const id = k.slice(2)
          const f = isF ? formulaById[id] : undefined
          const t = isF ? undefined : termById[id]
          const open = () => (isF ? onOpenFormula(id) : onOpenTerm(id))
          return (
            <div className="card fav" key={k}>
              <div className="fav-top">
                <button className="star on" onClick={() => toggleFav(k)} aria-label="הסרה מ'לזכור'">
                  <StarIcon filled />
                </button>
                <button className="names" style={{ textAlign: 'right' }} onClick={open}>
                  <span className="en" dir="ltr">
                    {f?.en ?? t?.en}
                  </span>
                  <span className="he">{f?.he ?? t?.he}</span>
                </button>
              </div>
              <div className="fav-body">
                <StickyNote k={k} />
                {f ? (
                  <button className="ftex" onClick={open} aria-label={`פתיחת ${f.he}`}>
                    <FitTex tex={f.cardTex ?? f.tex} min={0.4} />
                  </button>
                ) : (
                  <div className="short"><Bidi text={t!.short} /></div>
                )}
              </div>
            </div>
          )
        })}
        <Doodles />
      </div>
    </main>
  )
}
