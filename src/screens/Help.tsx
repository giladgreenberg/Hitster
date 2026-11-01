// הוראות המשחק – התוכן נלקח ישירות מה-README שב-GitHub, כך שהוא תמיד מעודכן.
import { useMemo } from 'react'
import { marked } from 'marked'
import readme from '../../README.md?raw'

export default function Help({ onBack }: { onBack: () => void }) {
  const html = useMemo(() => {
    const out = marked.parse(readme, { async: false, gfm: true }) as string
    // קישורים נפתחים בלשונית חדשה (כדי לא לצאת מהמשחק)
    return out.replace(/<a href="(https?:)/g, '<a target="_blank" rel="noreferrer" href="$1')
  }, [])

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 pb-16">
      <header className="sticky top-0 z-10 -mx-4 flex items-center justify-between bg-[#0f0a1e]/95 px-4 py-3 backdrop-blur">
        <h1 className="text-2xl font-black">📖 הוראות המשחק</h1>
        <button onClick={onBack} className="rounded-lg bg-white/10 px-3 py-2">
          → חזרה
        </button>
      </header>
      <article className="md-content" dangerouslySetInnerHTML={{ __html: html }} />
      <button onClick={onBack} className="w-full rounded-2xl bg-green-500 py-4 text-xl font-black text-black active:scale-95">
        הבנתי, בואו נשחק! 🎶
      </button>
    </main>
  )
}
