import { useMemo, useState } from 'react'
import { formulaById, formulas } from '../data/formulas'
import { termById, terms } from '../data/glossary'
import { CheckIcon, CloseIcon, StarIcon } from '../components/Icons'
import { Bidi, FitTex, Tex } from '../components/Tex'
import { exists, formulaBody, makeQuestion, pickSession, type Question } from '../lib/quiz'
import { useStore, type QuizMode, type QuizSource } from '../lib/store'

interface Item {
  key: string
  /** כיוון הכרטיסייה: 0 = שם ← נוסחה/פירוש, 1 = הפוך */
  dir: 0 | 1
  q?: Question
  retry?: boolean
}

interface Session {
  mode: QuizMode
  items: Item[]
  pos: number
  /** תשובה ראשונה לכל פריט (זה מה שנספר בציון) */
  first: Record<string, boolean>
  total: number
}

const SOURCES: [QuizSource, string][] = [
  ['favs', '★ המסומנים שלי'],
  ['weak', 'דורשים חיזוק'],
  ['formulas', 'כל הנוסחאות'],
  ['terms', 'כל המילון'],
]
const COUNTS: [number, string][] = [
  [10, '10'],
  [20, '20'],
  [9999, 'הכל'],
]

function nameOf(key: string) {
  if (key.startsWith('f:')) {
    const f = formulaById[key.slice(2)]
    return { en: f.en, he: f.he }
  }
  const t = termById[key.slice(2)]
  return { en: t.en, he: t.he }
}

export function QuizScreen({ hidden, onOpenFormula, onOpenTerm }: { hidden: boolean; onOpenFormula: (id: string) => void; onOpenTerm: (id: string) => void }) {
  const { s, set, recordQuiz } = useStore()
  const prefs = s.quizPrefs
  const [session, setSession] = useState<Session | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [chosen, setChosen] = useState<number | null>(null)

  const favKeys = s.favs.filter(exists)
  const weakKeys = Object.entries(s.quizStats)
    .filter(([k, st]) => exists(k) && !st.lastOk)
    .map(([k]) => k)
  const pool = useMemo(() => {
    if (prefs.source === 'favs') return favKeys
    if (prefs.source === 'weak') return weakKeys
    if (prefs.source === 'formulas') return formulas.map((f) => 'f:' + f.id)
    return terms.map((t) => 't:' + t.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.source, s.favs, s.quizStats])

  const mastered = favKeys.filter((k) => s.quizStats[k]?.lastOk).length
  const setPrefs = (p: Partial<typeof prefs>) => set((st) => ({ quizPrefs: { ...st.quizPrefs, ...p } }))

  const start = (keys: string[], mode: QuizMode) => {
    const picked = pickSession(keys, s.quizStats, prefs.count)
    const items: Item[] = picked.map((key) => ({ key, dir: Math.random() < 0.5 ? 0 : 1, q: mode === 'mcq' ? makeQuestion(key) : undefined }))
    setSession({ mode, items, pos: 0, first: {}, total: items.length })
    setFlipped(false)
    setChosen(null)
  }

  const open = (key: string) => (key.startsWith('f:') ? onOpenFormula(key.slice(2)) : onOpenTerm(key.slice(2)))

  // ---------- מסך פתיחה ----------
  if (!session) {
    const fCount = favKeys.filter((k) => k.startsWith('f:')).length
    return (
      <main className="screen" hidden={hidden}>
        <div className="screen-inner">
          <div className="card quiz-hero">
            <div className="quiz-hero-title">בחנו את עצמכם</div>
            <div className="quiz-hero-sub">
              <StarIcon size={16} filled style={{ color: 'var(--teal)', verticalAlign: -2 }} /> {favKeys.length} פריטים מסומנים ({fCount} נוסחאות, {favKeys.length - fCount} מושגים)
            </div>
            {favKeys.length > 0 && (
              <>
                <div className="bar" role="progressbar" aria-label="שליטה במסומנים" aria-valuemin={0} aria-valuemax={favKeys.length} aria-valuenow={mastered}>
                  <div style={{ width: `${(mastered / favKeys.length) * 100}%`, background: 'var(--good-solid)' }} />
                </div>
                <div className="quiz-hero-sub">
                  ענית נכון בפעם האחרונה על {mastered} מתוך {favKeys.length}
                </div>
              </>
            )}
          </div>

          <div className="ed-sec">סוג תרגול</div>
          <div className="mode-pick">
            <button className={'card mode' + (prefs.mode === 'cards' ? ' sel' : '')} onClick={() => setPrefs({ mode: 'cards' })} aria-pressed={prefs.mode === 'cards'}>
              <span className="mode-ico">🃏</span>
              <b>כרטיסיות</b>
              <span>הופכים כרטיס ומסמנים אם ידעתם</span>
            </button>
            <button className={'card mode' + (prefs.mode === 'mcq' ? ' sel' : '')} onClick={() => setPrefs({ mode: 'mcq' })} aria-pressed={prefs.mode === 'mcq'}>
              <span className="mode-ico">✅</span>
              <b>חידון אמריקאי</b>
              <span>4 תשובות, כולל שאלות חישוב</span>
            </button>
          </div>

          <div className="ed-sec">על מה להיבחן</div>
          <div className="chips wrap">
            {SOURCES.map(([k, v]) => (
              <button key={k} className={'chip' + (prefs.source === k ? ' active' : '')} onClick={() => setPrefs({ source: k })} aria-pressed={prefs.source === k}>
                {v}
                {k === 'weak' && weakKeys.length > 0 && <span className="count">{weakKeys.length}</span>}
              </button>
            ))}
          </div>

          <div className="ed-sec">כמה שאלות</div>
          <div className="chips wrap">
            {COUNTS.map(([n, v]) => (
              <button key={n} className={'chip' + (prefs.count === n ? ' active' : '')} style={{ minWidth: 64, justifyContent: 'center' }} onClick={() => setPrefs({ count: n })} aria-pressed={prefs.count === n}>
                {v}
              </button>
            ))}
          </div>

          {pool.length === 0 ? (
            <div className="empty">
              <span className="big">{prefs.source === 'weak' ? '🎉' : '☆'}</span>
              {prefs.source === 'weak' ? 'אין פריטים שדורשים חיזוק. כל הכבוד!' : 'עדיין לא סימנתם פריטים בכוכב. סמנו נוסחאות ומושגים, או בחרו "כל הנוסחאות".'}
            </div>
          ) : (
            <button className="btn solid wide" style={{ marginTop: 22 }} onClick={() => start(pool, prefs.mode)}>
              התחל ({Math.min(prefs.count, pool.length)} {prefs.mode === 'cards' ? 'כרטיסיות' : 'שאלות'})
            </button>
          )}
        </div>
      </main>
    )
  }

  const { items, pos, total } = session
  const done = pos >= items.length

  // ---------- סיכום ----------
  if (done) {
    const keys = Object.keys(session.first)
    const right = keys.filter((k) => session.first[k]).length
    const wrong = keys.filter((k) => !session.first[k])
    const ratio = keys.length ? right / keys.length : 0
    return (
      <main className="screen" hidden={hidden}>
        <div className="screen-inner">
          <div className="card quiz-score">
            <div className="big-emoji">{ratio >= 0.9 ? '🏆' : ratio >= 0.7 ? '💪' : ratio >= 0.5 ? '📈' : '📚'}</div>
            <div className="score-num">
              {right}/{keys.length}
            </div>
            <div className="score-msg">{ratio >= 0.9 ? 'מצוין! אתם שולטים בחומר.' : ratio >= 0.7 ? 'יפה מאוד! עוד קצת חזרה וזה שם.' : ratio >= 0.5 ? 'בדרך הנכונה. כדאי לחזור על הטעויות.' : 'שווה לעבור שוב על ההסברים ולנסות שוב.'}</div>
          </div>
          {wrong.length > 0 && (
            <>
              <div className="ed-sec">לחזור על אלה ({wrong.length})</div>
              {wrong.map((k) => {
                const n = nameOf(k)
                return (
                  <button key={k} className="card picker-item" onClick={() => open(k)}>
                    <div className="en">{n.en}</div>
                    <div className="he">{n.he} · לחצו להסבר</div>
                  </button>
                )
              })}
              <button className="btn solid wide" style={{ marginTop: 14 }} onClick={() => start(wrong, session.mode)}>
                חזרה על הטעויות
              </button>
            </>
          )}
          <button className="btn wide" style={{ marginTop: 12 }} onClick={() => setSession(null)}>
            חידון חדש
          </button>
        </div>
      </main>
    )
  }

  const item = items[pos]
  const next = (ok: boolean) => {
    const first = { ...session.first }
    let nextItems = items
    if (!(item.key in first)) {
      first[item.key] = ok
      recordQuiz(item.key, ok)
    }
    // בכרטיסיות: מה שלא ידעתם חוזר שוב בהמשך הסשן (פעם אחת)
    if (!ok && session.mode === 'cards' && !item.retry) {
      nextItems = [...items]
      nextItems.splice(Math.min(items.length, pos + 4), 0, { ...item, retry: true, dir: item.dir === 0 ? 1 : 0 })
    }
    setSession({ ...session, items: nextItems, pos: pos + 1, first })
    setFlipped(false)
    setChosen(null)
  }

  const head = (
    <div className="quiz-head">
      <button className="iconbtn" onClick={() => (Object.keys(session.first).length ? setSession({ ...session, pos: items.length }) : setSession(null))} aria-label="סיום החידון">
        <CloseIcon />
      </button>
      <div className="bar" style={{ flex: 1, margin: 0 }}>
        <div style={{ width: `${(Math.min(pos, total) / total) * 100}%` }} />
      </div>
      <span className="quiz-count">
        {Math.min(pos + 1, items.length)}/{items.length}
      </span>
    </div>
  )

  // ---------- כרטיסיות ----------
  if (session.mode === 'cards') {
    const isF = item.key.startsWith('f:')
    const f = isF ? formulaById[item.key.slice(2)] : undefined
    const t = isF ? undefined : termById[item.key.slice(2)]
    const nameSide = (
      <>
        <div className="fc-en" dir="ltr">
          {f?.en ?? t!.en}
        </div>
        {(f || item.dir === 1) && <div className="fc-he">{f?.he ?? t!.he}</div>}
      </>
    )
    const front = f ? (
      item.dir === 0 ? (
        <>
          <div className="fc-ask">מהי הנוסחה?</div>
          {nameSide}
        </>
      ) : (
        <>
          <div className="fc-ask">מה מחשבת הנוסחה?</div>
          <div className="fc-tex">
            <FitTex tex={formulaBody(f)} min={0.5} />
          </div>
        </>
      )
    ) : item.dir === 0 ? (
      <>
        <div className="fc-ask">מה הפירוש?</div>
        <div className="fc-en" dir="ltr">
          {t!.en}
        </div>
      </>
    ) : (
      <>
        <div className="fc-ask">מה המושג באנגלית?</div>
        <div className="fc-he">{t!.he}</div>
        <div className="fc-short">
          <Bidi text={t!.short} />
        </div>
      </>
    )
    const back = f ? (
      <>
        {nameSide}
        <div className="fc-tex">
          <FitTex tex={f.tex} min={0.45} />
        </div>
        <div className="fc-short">
          <Bidi text={f.meaning} />
        </div>
      </>
    ) : (
      <>
        <div className="fc-en" dir="ltr">
          {t!.en}
        </div>
        <div className="fc-he">{t!.he}</div>
        <div className="fc-short">
          <Bidi text={t!.full} />
        </div>
      </>
    )
    return (
      <main className="screen" hidden={hidden}>
        <div className="screen-inner">
          {head}
          <div className={'flash' + (flipped ? ' flipped' : '')} onClick={() => setFlipped(!flipped)} role="button" aria-label={flipped ? 'הצד האחורי – לחצו להפיכה' : 'לחצו כדי לראות את התשובה'}>
            <div className="card flash-face front" aria-hidden={flipped}>
              {item.retry && <span className="pill ok">שוב</span>}
              {front}
              <div className="fc-hint">לחצו כדי להפוך ↻</div>
            </div>
            <div className="card flash-face back" aria-hidden={!flipped}>
              {back}
              <button
                className="linkish"
                onClick={(e) => {
                  e.stopPropagation()
                  open(item.key)
                }}
              >
                להסבר המלא ←
              </button>
            </div>
          </div>
          {flipped ? (
            <div className="answer-row">
              <button className="btn big bad" onClick={() => next(false)}>
                <CloseIcon size={20} /> לא ידעתי
              </button>
              <button className="btn big good" onClick={() => next(true)}>
                <CheckIcon size={20} /> ידעתי
              </button>
            </div>
          ) : (
            <button className="btn solid wide" style={{ marginTop: 16 }} onClick={() => setFlipped(true)}>
              הצג תשובה
            </button>
          )}
        </div>
      </main>
    )
  }

  // ---------- חידון אמריקאי ----------
  const q = item.q!
  const answered = chosen !== null
  return (
    <main className="screen" hidden={hidden}>
      <div className="screen-inner">
        {head}
        <div className="card mcq-q">
          <div className="fc-ask">{q.ask}</div>
          {q.promptTex && (
            <div className="fc-tex">
              <FitTex tex={q.promptTex} min={0.5} />
            </div>
          )}
          {q.promptText && (
            <div className={q.kind === 'calc' || q.kind === 'def2term' ? 'mcq-text' : 'fc-en'} dir={q.kind === 'term2he' ? 'ltr' : undefined}>
              <Bidi text={q.promptText} />
            </div>
          )}
          {q.promptSub && <div className="fc-sub">{q.promptSub}</div>}
        </div>
        <div className="mcq-opts">
          {q.options.map((o, i) => {
            const cls = !answered ? '' : i === q.answer ? ' right' : i === chosen ? ' wrong' : ' dim'
            return (
              <button
                key={i}
                className={'card mcq-opt' + cls}
                disabled={answered}
                onClick={() => {
                  setChosen(i)
                }}
              >
                <span className="mcq-letter">{'אבגד'[i]}</span>
                <span className="mcq-body">{o.tex ? <Tex tex={'\\displaystyle ' + o.tex} /> : <Bidi text={o.text ?? ''} />}</span>
                {answered && i === q.answer && <CheckIcon />}
                {answered && i === chosen && i !== q.answer && <CloseIcon size={18} />}
              </button>
            )
          })}
        </div>
        {answered && (
          <>
            <div className={'mcq-feedback ' + (chosen === q.answer ? 'good' : 'bad')}>{chosen === q.answer ? '✓ נכון!' : '✗ לא נכון. התשובה הנכונה מסומנת בירוק.'}</div>
            <div className="answer-row">
              <button className="btn" onClick={() => open(q.key)}>
                להסבר המלא
              </button>
              <button className="btn solid" onClick={() => next(chosen === q.answer)}>
                {pos + 1 >= items.length ? 'לסיכום' : 'הבא ←'}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

