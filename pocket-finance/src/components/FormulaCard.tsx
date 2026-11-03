import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { Formula } from '../data/types'
import { onFontsReady, scheduleMeasure } from '../lib/measure'
import { useStore } from '../lib/store'
import { Bidi, FitTex } from './Tex'
import { StarIcon } from './Icons'

/** מקטין מעט את הגופן של שם ארוך לפני שהוא נחתך ב-… (מדידה אחת, בלי לולאה) */
function useShrinkText(ref: React.RefObject<HTMLElement | null>, max = 15, min = 12.5) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let alive = true
    const job = () => {
      if (!alive || !el.firstChild) return
      const r = document.createRange()
      r.selectNodeContents(el)
      const cur = parseFloat(el.style.fontSize) || max
      const text = (r.getBoundingClientRect().width * max) / cur
      const have = el.clientWidth
      return () => {
        if (!have) return
        const size = text <= have + 1 ? max : Math.max(min, Math.floor((max * have * 2) / text) / 2)
        const v = size + 'px'
        if (el.style.fontSize !== v) el.style.fontSize = v
      }
    }
    const fit = () => scheduleMeasure(job)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    onFontsReady(fit)
    return () => {
      alive = false
      ro.disconnect()
    }
  }, [ref, max, min])
}

export function FormulaCard({ f, onOpen }: { f: Formula; onOpen: (id: string) => void }) {
  const { isFav, toggleFav, isLearned } = useStore()
  const fav = isFav('f:' + f.id)
  const card = useRef<HTMLDivElement>(null)
  const en = useRef<HTMLDivElement>(null)
  const natural = useRef(0)
  const [stack, setStack] = useState(false)
  useShrinkText(en)

  // אם הנוסחה לא נכנסת בצד שמאל בגודל קריא – היא יורדת לשורה שנייה (עדיין בצד שמאל)
  const decide = useCallback(() => {
    scheduleMeasure(() => {
      const c = card.current
      const names = c?.querySelector('.names')
      if (!c || !names || !natural.current) return
      const inner = c.clientWidth - 28
      const nat = Math.max(...[...names.children].map((x) => (x as HTMLElement).scrollWidth))
      const avail = inner - 34 - 20 - Math.min(nat, inner * 0.66)
      return () => setStack(natural.current * 0.75 > avail)
    })
  }, [])
  useLayoutEffect(() => {
    const c = card.current
    if (!c) return
    const ro = new ResizeObserver(decide)
    ro.observe(c)
    return () => ro.disconnect()
  }, [decide])

  return (
    <div ref={card} className={'card fcard' + (stack ? ' stack' : '')} role="button" tabIndex={0} onClick={() => onOpen(f.id)} onKeyDown={(e) => e.key === 'Enter' && onOpen(f.id)}>
      <button
        className={'star' + (fav ? ' on' : '')}
        aria-label={fav ? 'הסרה מ"לזכור"' : 'סימון "לזכור"'}
        aria-pressed={fav}
        onClick={(e) => {
          e.stopPropagation()
          toggleFav('f:' + f.id)
        }}
      >
        <StarIcon filled={fav} />
      </button>
      <div className="names">
        <div className="en" title={f.en} ref={en}>
          {f.en}
        </div>
        <div className="he">
          {f.he}
          {isLearned(f.id) && (
            <span className="learned-mark" aria-label="נלמד">
              ✓
            </span>
          )}
        </div>
        {f.goodRange && (
          <span className="pill good">
            <Bidi text={f.goodRange} />
          </span>
        )}
      </div>
      <div className="ftex">
        <FitTex
          tex={f.cardTex ?? f.tex}
          min={0.5}
          onNatural={(w) => {
            if (w !== natural.current) {
              natural.current = w
              decide()
            }
          }}
        />
      </div>
    </div>
  )
}
