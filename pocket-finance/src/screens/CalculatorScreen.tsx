import { useEffect, useMemo, useState } from 'react'
import { formulaById, formulas, topicById } from '../data/formulas'
import { ChevronDown, SearchIcon } from '../components/Icons'
import { Sheet, useBackClose } from '../components/Sheet'
import { Bidi, FitTex, Rich } from '../components/Tex'
import { calculators, runCalculator, type CalcInput } from '../lib/calculators'
import { shortLabel } from '../lib/labels'
import { matches } from '../lib/search'
import { useStore } from '../lib/store'

function Picker({ current, onPick, onClose }: { current: string; onPick: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const { orderedTopics } = useStore()
  const list = formulas.filter((f) => calculators[f.id] && matches(q, f.en, f.he, f.id, f.keywords ?? []))
  return (
    <Sheet
      label="בחירת נוסחה"
      full
      onClose={onClose}
      head={
        <div className="search" style={{ marginTop: 4, marginLeft: 34, height: 46 }}>
          <input type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש נוסחה…" aria-label="חיפוש נוסחה" />
          <SearchIcon size={20} />
        </div>
      }
    >
      <div className="picker-list">
        {orderedTopics().map((t) => {
          const items = list.filter((f) => f.topic === t)
          if (!items.length) return null
          return (
            <div key={t}>
              <div className="grp">{topicById[t].name}</div>
              {items.map((f) => (
                <button key={f.id} className={'card picker-item' + (f.id === current ? ' sel' : '')} onClick={() => onPick(f.id)}>
                  <div className="en">{f.en}</div>
                  <div className="he">{f.he}</div>
                </button>
              ))}
            </div>
          )
        })}
        {list.length === 0 && <div className="empty">לא נמצאו נוסחאות</div>}
      </div>
    </Sheet>
  )
}

function Field({ inp, value, onChange }: { inp: CalcInput; value: string; onChange: (v: string) => void }) {
  const id = 'in-' + inp.key
  const unit = inp.kind === 'pct' ? '%' : ''
  return (
    <div className="field">
      <label htmlFor={id}>{inp.label}</label>
      <div className={'input-wrap' + (unit ? ' has-unit' : '')}>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode={inp.kind === 'list' || inp.signed ? 'text' : 'decimal'}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          dir="ltr"
        />
        {unit && <span className="unit">{unit}</span>}
      </div>
      {inp.hint && <div className="hint"><Bidi text={inp.hint} /></div>}
    </div>
  )
}

export function CalculatorScreen({ hidden, calcId, setCalcId }: { hidden: boolean; calcId: string; setCalcId: (id: string) => void }) {
  const { s, set, touchCalc } = useStore()
  const [picking, setPicking] = useState(false)
  const [showSteps, setShowSteps] = useState(false)
  useBackClose(picking, () => setPicking(false))

  const f = formulaById[calcId] ?? formulaById.npv
  const calc = calculators[f.id]
  const defaults = useMemo(() => Object.fromEntries(Object.entries(f.example.values).map(([k, v]) => [k, String(v)])), [f])
  const values = { ...defaults, ...(s.calcInputs[f.id] ?? {}) }
  const res = runCalculator(calc, values)

  useEffect(() => setShowSteps(false), [f.id])

  const setVal = (k: string, v: string) => set((p) => ({ calcInputs: { ...p.calcInputs, [f.id]: { ...(p.calcInputs[f.id] ?? {}), [k]: v } } }))
  const changed = calc.inputs.some((i) => values[i.key] !== defaults[i.key])

  const pick = (id: string) => {
    setCalcId(id)
    touchCalc(id)
    setPicking(false)
  }

  const recent = s.recentCalcs.filter((id) => formulaById[id] && calculators[id]).slice(0, 4)

  return (
    <main className="screen" hidden={hidden}>
      <div className="screen-inner">
        <button className="card picker" onClick={() => setPicking(true)} aria-haspopup="dialog">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="lbl">בחר נוסחה:</div>
            <div className="val">
              <span dir="ltr">{f.en}</span> – {f.he}
            </div>
          </div>
          <ChevronDown />
        </button>

        <div className="recent" aria-label="מחשבונים אחרונים">
          {recent.map((id) => (
            <button key={id} className={'chip' + (id === f.id ? ' active' : '')} onClick={() => pick(id)} title={formulaById[id].he}>
              {shortLabel(formulaById[id])}
            </button>
          ))}
        </div>

        <div className="card calc-formula">
          <FitTex tex={f.tex} min={0.5} />
        </div>

        <div className="card fields">
          {calc.inputs.map((inp) => (
            <Field key={inp.key} inp={inp} value={values[inp.key] ?? ''} onChange={(v) => setVal(inp.key, v)} />
          ))}
          {changed && (
            <button className="reset" onClick={() => set((p) => ({ calcInputs: { ...p.calcInputs, [f.id]: {} } }))}>
              ↺ חזרה לערכי הדוגמה
            </button>
          )}
        </div>

        <div className="result" aria-live="polite">
          <div className="main">{res.error && res.value === null && !res.label ? '—' : `${res.label} = ${res.text}`}</div>
          {res.badge && <div className={'badge ' + res.badge.tone}><Bidi text={res.badge.text} /></div>}
          {res.error && <div className="err"><Bidi text={res.error} /></div>}
          {res.extras?.map((x, i) => (
            <div className="extra" key={i}>
              <Bidi text={x} />
            </div>
          ))}
        </div>

        {res.steps.length > 0 && (
          <>
            <button className="btn wide" style={{ marginTop: 14 }} onClick={() => setShowSteps(!showSteps)} aria-expanded={showSteps}>
              {showSteps ? 'הסתר את הפתרון' : 'הצג פתרון שלב אחרי שלב'}
            </button>
            {showSteps && (
              <div className="card calc-steps">
                <ol className="steps">
                  {res.steps.map((st, i) => (
                    <li key={i}>
                      <Rich text={st} />
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
      </div>
      {picking && <Picker current={f.id} onPick={pick} onClose={() => setPicking(false)} />}
    </main>
  )
}
