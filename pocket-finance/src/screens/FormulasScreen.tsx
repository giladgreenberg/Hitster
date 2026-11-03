import { useMemo, useState } from 'react'
import { formulaById, formulas, topicById } from '../data/formulas'
import type { Formula } from '../data/types'
import { FormulaCard } from '../components/FormulaCard'
import { ChevronDown, CloseIcon, PencilIcon, SearchIcon, StarIcon } from '../components/Icons'
import { matches } from '../lib/search'
import { useStore, type SortMode } from '../lib/store'

const SORT_LABELS: Record<SortMode, string> = { custom: 'סדר אישי', alpha: 'א-ב', starred: 'מסומנים קודם' }

export function FormulasScreen({ hidden, onOpen, onEdit, onGoFavs }: { hidden: boolean; onOpen: (id: string) => void; onEdit: () => void; onGoFavs: () => void }) {
  const store = useStore()
  const { s, set, orderedTopics, orderedFormulas, isFav } = store
  const [q, setQ] = useState('')
  const [topic, setTopic] = useState<string>('all')

  const topicIds = orderedTopics()
  const learnedCount = s.learned.filter((id) => formulaById[id]).length
  const favCount = s.favs.filter((k) => k.startsWith('f:') && formulaById[k.slice(2)]).length

  const groups = useMemo(() => {
    const out: { topic: string; items: Formula[] }[] = []
    for (const t of topicIds) {
      if (topic !== 'all' && topic !== t) continue
      let items = orderedFormulas(t)
        .map((id) => formulaById[id])
        .filter((f) => matches(q, f.en, f.he, f.id, f.keywords ?? [], topicById[f.topic].name))
      if (s.sort === 'alpha') items = [...items].sort((a, b) => a.he.localeCompare(b.he, 'he'))
      if (s.sort === 'starred') items = [...items].sort((a, b) => Number(isFav('f:' + b.id)) - Number(isFav('f:' + a.id)))
      if (items.length) out.push({ topic: t, items })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, topic, s.sort, s.topicOrder, s.formulaOrder, s.favs])

  const sortSelect = (
    <label className="sort">
      <span className="visually-hidden">מיון</span>
      <span aria-hidden>מיון:</span>
      <select value={s.sort} onChange={(e) => set(() => ({ sort: e.target.value as SortMode }))}>
        {Object.entries(SORT_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <ChevronDown size={16} />
    </label>
  )

  return (
    <main className="screen" hidden={hidden}>
      <div className="screen-inner">
        <div className="search">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש נוסחה… (NPV, WACC, יחס שוטף)" aria-label="חיפוש נוסחה" enterKeyHint="search" />
          {q ? (
            <button className="clear" onClick={() => setQ('')} aria-label="ניקוי חיפוש">
              <CloseIcon size={18} />
            </button>
          ) : (
            <SearchIcon />
          )}
        </div>

        <div className="chips" aria-label="נושאים">
          <button className={'chip' + (topic === 'all' ? ' active' : '')} onClick={() => setTopic('all')} aria-pressed={topic === 'all'}>
            הכל
          </button>
          {topicIds.map((t) => (
            <button key={t} className={'chip' + (topic === t ? ' active' : '')} onClick={() => setTopic(t)} aria-pressed={topic === t}>
              {topicById[t].short}
            </button>
          ))}
          <button className="chip ghost" onClick={onEdit}>
            <PencilIcon /> עריכת נושאים
          </button>
        </div>

        <div className="card progress">
          <div className="progress-title">
            נלמדו: {learnedCount}/{formulas.length} נוסחאות
          </div>
          <div className="bar" role="progressbar" aria-label="התקדמות בלימוד" aria-valuemin={0} aria-valuemax={formulas.length} aria-valuenow={learnedCount}>
            <div style={{ width: `${(learnedCount / formulas.length) * 100}%` }} />
          </div>
          <button className="linkish" onClick={onGoFavs}>
            <StarIcon size={18} filled /> {favCount} מסומנות לזכור
          </button>
        </div>

        {groups.length === 0 && (
          <>
            <div className="toolbar">
              <span />
              {sortSelect}
            </div>
            <div className="empty">
              <span className="big">🔍</span>
              לא נמצאו נוסחאות עבור "{q}"
            </div>
          </>
        )}

        {groups.map((g, gi) => (
          <section key={g.topic}>
            <div className="group-head">
              <h2>{topicById[g.topic].name}</h2>
              {gi === 0 && sortSelect}
            </div>
            {g.items.map((f) => (
              <FormulaCard key={f.id} f={f} onOpen={onOpen} />
            ))}
          </section>
        ))}
      </div>
    </main>
  )
}
