// הודעת שגיאה + כפתור שמעתיק פרטי אבחון (יומן הבקשות לספוטיפיי) כדי לשלוח למפתח
import { useState } from 'react'
import { logAsText } from './RequestLog'

export default function ErrorBox({ error }: { error: string }) {
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle')
  const details = () => `שגיאה: ${error}\nדפדפן: ${navigator.userAgent}\nזמן: ${new Date().toLocaleString('he-IL')}\n\n${logAsText()}`
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(details())
      setCopied('ok')
    } catch {
      setCopied('fail')
    }
  }
  return (
    <div className="space-y-2 rounded-xl bg-red-500/20 p-3 text-red-200">
      <p className="whitespace-pre-line">{error}</p>
      <button onClick={copy} className="w-full rounded-lg bg-white/10 py-2 text-sm text-white">
        {copied === 'ok' ? '✓ הועתק – הדביקו בצ׳אט' : '📋 העתקת פרטים לשליחה'}
      </button>
      {copied === 'fail' && (
        <textarea dir="ltr" readOnly value={details()} className="h-40 w-full rounded-lg bg-black/40 p-2 text-left text-[11px]" onFocus={(e) => e.target.select()} />
      )}
    </div>
  )
}
