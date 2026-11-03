import { useCallback, useState } from 'react'
import { BottomNav, type Tab } from './components/BottomNav'
import { FormulaSheet } from './components/FormulaSheet'
import { InstallBanner } from './components/InstallBanner'
import { useBackClose } from './components/Sheet'
import { TermSheet } from './components/TermSheet'
import { useStore } from './lib/store'
import { CalculatorScreen } from './screens/CalculatorScreen'
import { FavoritesScreen } from './screens/FavoritesScreen'
import { FormulasScreen } from './screens/FormulasScreen'
import { GlossaryScreen } from './screens/GlossaryScreen'
import { TopicEditor } from './screens/TopicEditor'

type SheetState = { kind: 'formula' | 'term'; id: string } | null

export default function App() {
  const { s, touchCalc } = useStore()
  const [tab, setTabRaw] = useState<Tab>('formulas')
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set(['formulas']))
  const setTab = useCallback((t: Tab) => {
    setTabRaw(t)
    setVisited((v) => (v.has(t) ? v : new Set(v).add(t)))
  }, [])
  const [sheet, setSheet] = useState<SheetState>(null)
  const [editing, setEditing] = useState(false)
  const [showInstall, setShowInstall] = useState(false)
  const [calcId, setCalcId] = useState<string>(() => s.recentCalcs[0] ?? 'npv')

  const closeSheet = useCallback(() => setSheet(null), [])
  useBackClose(!!sheet, closeSheet)
  useBackClose(editing, () => setEditing(false))

  const openFormula = useCallback((id: string) => setSheet({ kind: 'formula', id }), [])
  const openTerm = useCallback((id: string) => setSheet({ kind: 'term', id }), [])
  const openInCalc = (id: string) => {
    setCalcId(id)
    touchCalc(id)
    setSheet(null)
    setTab('calc')
  }

  return (
    <>
      {visited.has('calc') && <CalculatorScreen hidden={tab !== 'calc'} calcId={calcId} setCalcId={setCalcId} />}
      <FormulasScreen hidden={tab !== 'formulas'} onOpen={openFormula} onEdit={() => setEditing(true)} onGoFavs={() => setTab('favs')} />
      {visited.has('favs') && <FavoritesScreen hidden={tab !== 'favs'} onOpenFormula={openFormula} onOpenTerm={openTerm} />}
      {visited.has('glossary') && <GlossaryScreen hidden={tab !== 'glossary'} onOpenTerm={openTerm} onOpenFormula={openFormula} />}
      <BottomNav tab={tab} onTab={setTab} />
      {!sheet && !editing && <InstallBanner force={showInstall} onDone={() => setShowInstall(false)} />}
      {editing && (
        <TopicEditor
          onClose={() => setEditing(false)}
          onShowInstall={() => {
            setShowInstall(true)
            setEditing(false)
          }}
        />
      )}
      {sheet?.kind === 'formula' && <FormulaSheet key={sheet.id} id={sheet.id} onClose={closeSheet} onOpenCalc={openInCalc} />}
      {sheet?.kind === 'term' && <TermSheet key={sheet.id} id={sheet.id} onClose={closeSheet} onOpenTerm={openTerm} onOpenFormula={openFormula} />}
    </>
  )
}
