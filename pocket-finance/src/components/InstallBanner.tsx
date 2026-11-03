import { useEffect, useState } from 'react'
import { useStore } from '../lib/store'
import { CloseIcon, ShareIcon } from './Icons'

interface BIPEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

let deferred: BIPEvent | null = null
const listeners = new Set<() => void>()
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as BIPEvent
  listeners.forEach((l) => l())
})
window.addEventListener('appinstalled', () => {
  deferred = null
  listeners.forEach((l) => l())
})

/** באנדרואיד: כפתור "התקן אפליקציה". באייפון: הסבר שיתוף ← הוסף למסך הבית */
export function InstallBanner({ force, onDone }: { force: boolean; onDone: () => void }) {
  const { s, set } = useStore()
  const [, tick] = useState(0)
  useEffect(() => {
    const l = () => tick((x) => x + 1)
    listeners.add(l)
    return () => void listeners.delete(l)
  }, [])

  if (isStandalone()) {
    if (force) return <Banner onClose={onDone}>האפליקציה כבר מותקנת ופועלת ממסך הבית 🎉</Banner>
    return null
  }
  if (s.installDismissed && !force) return null
  const dismiss = () => {
    set(() => ({ installDismissed: true }))
    onDone()
  }

  if (deferred) {
    return (
      <Banner onClose={dismiss}>
        <span className="txt">התקינו את "יומן כיס" למסך הבית – עובד גם בלי אינטרנט</span>
        <button
          className="go"
          onClick={async () => {
            const d = deferred
            if (!d) return
            await d.prompt()
            await d.userChoice
            deferred = null
            dismiss()
          }}
        >
          התקן אפליקציה
        </button>
      </Banner>
    )
  }
  if (isIOS()) {
    return (
      <Banner onClose={dismiss}>
        <span className="txt">
          להתקנה באייפון: ב-Safari לחצו על שיתוף <ShareIcon size={18} className="share-ico" /> ואז על <b>"הוסף למסך הבית"</b>
        </span>
      </Banner>
    )
  }
  if (force) {
    return (
      <Banner onClose={onDone}>
        <span className="txt">
          באנדרואיד (Chrome): תפריט ⋮ ← <b>"התקנת אפליקציה"</b> או <b>"הוספה למסך הבית"</b>. באייפון (Safari): שיתוף ← <b>"הוסף למסך הבית"</b>.
        </span>
      </Banner>
    )
  }
  return null
}

function Banner({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="install" role="region" aria-label="התקנת האפליקציה">
      <img src="/icon-96.png" alt="" />
      {children}
      <button className="x" onClick={onClose} aria-label="סגירה">
        <CloseIcon size={18} />
      </button>
    </div>
  )
}
