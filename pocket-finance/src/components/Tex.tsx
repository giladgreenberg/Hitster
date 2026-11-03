import katex from 'katex'
import type React from 'react'
import { Fragment, memo, useLayoutEffect, useRef } from 'react'
import { onFontsReady, scheduleMeasure } from '../lib/measure'

const cache = new Map<string, string>()

function render(tex: string, display: boolean): string {
  const k = (display ? 'D' : 'I') + tex
  let html = cache.get(k)
  if (html === undefined) {
    html = katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: false, output: 'html' })
    cache.set(k, html)
  }
  return html
}

export const Tex = memo(function Tex({ tex, display = false, className = '' }: { tex: string; display?: boolean; className?: string }) {
  return <span className={'tex ' + className} dir="ltr" dangerouslySetInnerHTML={{ __html: render(tex, display) }} />
})

/** מקטין את הנוסחה כדי שתיכנס לרוחב הזמין (בלי לגלוש על הטקסט שלידה) */
export function FitTex({ tex, min = 0.55, onNatural }: { tex: string; min?: number; onNatural?: (w: number) => void }) {
  const t = '\\displaystyle ' + tex
  const box = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const onNaturalRef = useRef(onNatural)
  onNaturalRef.current = onNatural
  useLayoutEffect(() => {
    const b = box.current
    const i = inner.current
    if (!b || !i) return
    let alive = true
    // transform לא משפיע על offsetWidth, לכן אפשר למדוד בלי לאפס קודם
    const job = () => {
      if (!alive) return
      const avail = b.clientWidth
      const need = i.offsetWidth
      const h = i.offsetHeight
      return () => {
        onNaturalRef.current?.(need)
        if (!avail || !need) return
        const sc = Math.max(min, Math.min(1, avail / need))
        const tf = sc < 1 ? `scale(${sc})` : ''
        const hh = sc < 1 ? h * sc + 'px' : ''
        if (i.style.transform !== tf) i.style.transform = tf
        if (b.style.height !== hh) b.style.height = hh
      }
    }
    const fit = () => scheduleMeasure(job)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(b)
    onFontsReady(fit)
    return () => {
      alive = false
      ro.disconnect()
    }
  }, [t, min])
  return (
    <div className="fit" ref={box}>
      <div className="fit-inner" ref={inner}>
        <Tex tex={t} />
      </div>
    </div>
  )
}

/** טקסט עם קטעי TeX בין $...$ */
export function Rich({ text }: { text: string }) {
  const parts = text.split('$')
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <Tex key={i} tex={'\\displaystyle ' + p} /> : <Fragment key={i}><Bidi text={p} /></Fragment>))}
    </>
  )
}

// רצף לטיני/מתמטי (למשל "β = 1", "1.5–2", "IRR > 10%") מוצג כיחידה LTR מבודדת,
// כדי שלא יתהפך בתוך משפט בעברית
const LTR_RUN = /(?:[-−](?=\d))?[A-Za-z0-9Ͱ-Ͽ₀-₉][A-Za-z0-9Ͱ-Ͽ₀-₉²³ .,=+\-−×÷/%<>≈≥≤^·'()–]*[A-Za-z0-9Ͱ-Ͽ₀-₉²³%)]|[A-Za-z0-9Ͱ-Ͽ]/g

export function Bidi({ text }: { text: string }) {
  const out: React.ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(LTR_RUN)) {
    let i = m.index ?? 0
    let run = m[0]
    // מינוס צמוד לאות עברית הוא מקף ("ב-10%"), לא סימן שלילי
    if ((run[0] === '-' || run[0] === '−') && i > 0 && /[\u0590-\u05FF]/.test(text[i - 1])) {
      run = run.slice(1)
      i += 1
    }
    // לא לבלוע סוגריים לא מאוזנים
    const open = (run.match(/\(/g) ?? []).length
    const close = (run.match(/\)/g) ?? []).length
    if (close > open && run.endsWith(')')) run = run.slice(0, run.length - (close - open))
    if (i > last) out.push(text.slice(last, i))
    out.push(
      <bdi dir="ltr" key={i}>
        {run}
      </bdi>,
    )
    last = i + run.length
  }
  if (last < text.length) out.push(text.slice(last))
  return <>{out}</>
}
