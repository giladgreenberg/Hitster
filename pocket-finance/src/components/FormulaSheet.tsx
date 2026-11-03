import { formulaById } from '../data/formulas'
import { calculators, runCalculator } from '../lib/calculators'
import { isRatio } from '../lib/labels'
import { useStore } from '../lib/store'
import { CalcIcon, CheckIcon, StarIcon } from './Icons'
import { Sheet } from './Sheet'
import { Bidi, FitTex, Rich, Tex } from './Tex'

export function FormulaSheet({ id, onClose, onOpenCalc }: { id: string; onClose: () => void; onOpenCalc: (id: string) => void }) {
  const f = formulaById[id]
  const { isFav, toggleFav, isLearned, toggleLearned } = useStore()
  if (!f) return null
  const fav = isFav('f:' + f.id)
  const learned = isLearned(f.id)
  const calc = calculators[f.id]
  const ex = calc ? runCalculator(calc, f.example.values) : null

  return (
    <Sheet
      label={f.he}
      onClose={onClose}
      head={
        <div className="sheet-title" style={{ paddingLeft: 36 }}>
          <div className="en">{f.en}</div>
          <div className="he">{f.he}</div>
        </div>
      }
      foot={
        <>
          <button className={'btn' + (fav ? ' on' : '')} onClick={() => toggleFav('f:' + f.id)} aria-pressed={fav}>
            <StarIcon size={20} filled={fav} /> לזכור
          </button>
          <button className={'btn' + (learned ? ' good-on' : '')} onClick={() => toggleLearned(f.id)} aria-pressed={learned}>
            <CheckIcon /> {learned ? 'נלמד' : 'סמן כנלמד'}
          </button>
          {calc && (
            <button className="btn solid" onClick={() => onOpenCalc(f.id)}>
              <CalcIcon size={20} /> פתח במחשבון
            </button>
          )}
        </>
      }
    >
      <div className="card formula-box">
        <FitTex tex={f.tex} min={0.5} />
      </div>

      <section className="sec">
        <h3>משתנים</h3>
        <div className="card vars">
          {f.vars.map(([sym, he]) => (
            <div className="row" key={sym}>
              <span className="sym">
                <Tex tex={sym} />
              </span>
              <span><Bidi text={he} /></span>
            </div>
          ))}
        </div>
      </section>

      <section className="sec">
        <h3>מה זה אומר</h3>
        <p><Bidi text={f.meaning} /></p>
      </section>

      <section className="sec">
        <h3>איך לפרש</h3>
        {f.interpret.levels && (
          <div className="levels">
            {f.interpret.levels.map((l, i) => (
              <div className={'level ' + l.tone} key={i}>
                <span className="dot" />
                <span>
                  <b>{l.tone === 'good' ? 'טוב' : l.tone === 'ok' ? 'סביר' : l.tone === 'bad' ? 'בעייתי' : ''}</b>
                  {l.tone !== 'info' && ': '}
                  <Bidi text={l.text} />
                </span>
              </div>
            ))}
          </div>
        )}
        {f.interpret.rules && (
          <ul className="rules">
            {f.interpret.rules.map((r, i) => (
              <li key={i}><Bidi text={r} /></li>
            ))}
          </ul>
        )}
        {isRatio(f) && <p className="note">* הטווחים הם כללי אצבע מקובלים. הם משתנים מאוד בין ענפים, ולכן כדאי להשוות לחברות מאותו ענף ולמגמה לאורך זמן.</p>}
        {f.interpret.note && <p className="note">{f.interpret.note}</p>}
      </section>

      <section className="sec">
        <h3>דוגמה פתורה</h3>
        <div className="card example">
          <div className="q"><Bidi text={f.example.text} /></div>
          {ex && (
            <>
              <ol className="steps">
                {ex.steps.map((s, i) => (
                  <li key={i}>
                    <Rich text={s} />
                  </li>
                ))}
              </ol>
              <div className="answer">
                תשובה: <span dir="ltr">{ex.label} = {ex.text}</span>
                {ex.badge && <div style={{ fontWeight: 500, marginTop: 4 }}><Bidi text={ex.badge.text} /></div>}
              </div>
            </>
          )}
        </div>
      </section>

      <section className="sec">
        <h3>טעויות נפוצות</h3>
        <ul className="rules x">
          {f.mistakes.map((m, i) => (
            <li key={i}><Bidi text={m} /></li>
          ))}
        </ul>
      </section>

      <section className="sec" style={{ marginBottom: 8 }}>
        <h3>טיפ למבחן</h3>
        <div className="tip">💡 <Bidi text={f.tip} /></div>
      </section>
    </Sheet>
  )
}
