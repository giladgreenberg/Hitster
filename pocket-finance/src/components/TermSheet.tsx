import { formulaById } from '../data/formulas'
import { termById } from '../data/glossary'
import { shortLabel } from '../lib/labels'
import { useStore } from '../lib/store'
import { StarIcon } from './Icons'
import { Sheet } from './Sheet'
import { Bidi } from './Tex'

export function TermSheet({ id, onClose, onOpenTerm, onOpenFormula }: { id: string; onClose: () => void; onOpenTerm: (id: string) => void; onOpenFormula: (id: string) => void }) {
  const t = termById[id]
  const { isFav, toggleFav } = useStore()
  if (!t) return null
  const fav = isFav('t:' + t.id)
  const f = t.formula ? formulaById[t.formula] : undefined
  return (
    <Sheet
      label={t.he}
      onClose={onClose}
      head={
        <div className="sheet-title" style={{ paddingLeft: 36 }}>
          <div className="en">{t.en}</div>
          <div className="he">{t.he}</div>
        </div>
      }
      foot={
        <button className={'btn' + (fav ? ' on' : '')} onClick={() => toggleFav('t:' + t.id)} aria-pressed={fav}>
          <StarIcon size={20} filled={fav} /> {fav ? 'מסומן לזכור' : 'לזכור'}
        </button>
      }
    >
      <section className="sec" style={{ marginTop: 10 }}>
        <h3>הסבר</h3>
        <p><Bidi text={t.full} /></p>
      </section>
      {t.details && t.details.length > 0 && (
        <section className="sec">
          <h3>בהרחבה</h3>
          <ul className="rules">
            {t.details.map((d, i) => (
              <li key={i}>
                <Bidi text={d} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {t.example && (
        <section className="sec">
          <h3>דוגמה</h3>
          <div className="tip"><Bidi text={t.example} /></div>
        </section>
      )}
      {f && (
        <section className="sec">
          <h3>נוסחה</h3>
          <button className="flink" onClick={() => onOpenFormula(f.id)}>
            נוסחת {shortLabel(f)} ←
          </button>
        </section>
      )}
      {t.related && t.related.length > 0 && (
        <section className="sec" style={{ marginBottom: 8 }}>
          <h3>מושגים קשורים</h3>
          <div className="rel">
            {t.related
              .filter((r) => termById[r])
              .map((r) => (
                <button className="chip" key={r} onClick={() => onOpenTerm(r)}>
                  <span dir="ltr">{termById[r].en}</span>
                </button>
              ))}
          </div>
        </section>
      )}
    </Sheet>
  )
}
