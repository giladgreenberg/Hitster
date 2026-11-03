import { useEffect, useRef, type ReactNode } from 'react'
import { CloseIcon } from './Icons'

/** כפתור "חזור" של אנדרואיד/דפדפן סוגר את השכבה הפתוחה */
export function useBackClose(open: boolean, close: () => void) {
  const pushed = useRef(false)
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(() => {
    if (open && !pushed.current) {
      history.pushState({ overlay: true }, '')
      pushed.current = true
      const onPop = () => {
        pushed.current = false
        closeRef.current()
      }
      window.addEventListener('popstate', onPop)
      return () => window.removeEventListener('popstate', onPop)
    }
    if (!open && pushed.current) {
      pushed.current = false
      history.back()
    }
  }, [open])
}

export function Sheet({ onClose, head, children, foot, full = false, label }: { onClose: () => void; head?: ReactNode; children: ReactNode; foot?: ReactNode; full?: boolean; label: string }) {
  const sheet = useRef<HTMLDivElement>(null)
  const start = useRef<number | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // גרירה למטה על הידית סוגרת
  const onDown = (e: React.PointerEvent) => {
    start.current = e.clientY
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (start.current === null || !sheet.current) return
    const dy = Math.max(0, e.clientY - start.current)
    sheet.current.style.transform = `translateY(${dy}px)`
  }
  const onUp = (e: React.PointerEvent) => {
    if (start.current === null || !sheet.current) return
    const dy = e.clientY - start.current
    start.current = null
    if (dy > 90) onClose()
    else sheet.current.style.transform = ''
  }

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className={'sheet' + (full ? ' full' : '')} ref={sheet} role="dialog" aria-modal="true" aria-label={label}>
        <div className="sheet-head" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <div className="grabber" />
          <button className="sheet-close" onClick={onClose} onPointerDown={(e) => e.stopPropagation()} aria-label="סגירה">
            <CloseIcon />
          </button>
          {head}
        </div>
        <div className="sheet-body">{children}</div>
        {foot && <div className="sheet-foot">{foot}</div>}
      </div>
    </>
  )
}
