import { AZIcon, BookmarkIcon, CalcIcon, CardsIcon, SigmaIcon } from './Icons'

export type Tab = 'calc' | 'formulas' | 'favs' | 'quiz' | 'glossary'

// מימין לשמאל: מחשבון | נוסחאות | לזכור | חידון | מילון
const TABS: { id: Tab; label: string }[] = [
  { id: 'calc', label: 'מחשבון' },
  { id: 'formulas', label: 'נוסחאות' },
  { id: 'favs', label: 'לזכור' },
  { id: 'quiz', label: 'חידון' },
  { id: 'glossary', label: 'מילון' },
]

function Icon({ id, active }: { id: Tab; active: boolean }) {
  if (id === 'calc') return <CalcIcon />
  if (id === 'formulas') return <SigmaIcon />
  if (id === 'favs') return <BookmarkIcon filled={active} />
  if (id === 'quiz') return <CardsIcon />
  return <AZIcon />
}

export function BottomNav({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav className="nav" aria-label="ניווט ראשי">
      <div className="nav-inner">
        {TABS.map((t) => (
          <button key={t.id} className={'tab' + (tab === t.id ? ' active' : '')} onClick={() => onTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            <Icon id={t.id} active={tab === t.id} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
