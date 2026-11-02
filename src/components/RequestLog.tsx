// יומן הבקשות לספוטיפיי – לאבחון בעיות (למשל "יותר מדי בקשות")
import { useEffect, useState } from 'react'
import { getRequestLog, rateLimitSecondsLeft, requestsInWindow, type RequestLogEntry } from '../spotify/api'
import { clientIdFromEnv, getClientId } from '../spotify/auth'

function summarize(log: RequestLogEntry[]) {
  const now = Date.now()
  const last30 = log.filter((e) => now - e.at < 30_000).length
  const last5m = log.filter((e) => now - e.at < 300_000)
  const r429 = last5m.filter((e) => e.status === 429)
  const byPath = new Map<string, number>()
  for (const e of last5m) byPath.set(`${e.method} ${e.path}`, (byPath.get(`${e.method} ${e.path}`) ?? 0) + 1)
  return { last30, last5m: last5m.length, r429: r429.length, lastRetry: r429.at(-1)?.retryAfter ?? null, byPath: [...byPath].sort((a, b) => b[1] - a[1]) }
}

export function logAsText(): string {
  const log = getRequestLog()
  const s = summarize(log)
  const id = getClientId()
  const lines = [
    `Client ID: ${id.slice(0, 6)}…${id.slice(-4)} (${clientIdFromEnv() ? 'מ-Vercel' : 'מהמסך'}) · בחלון הבלם: ${requestsInWindow()}`,
    `בקשות ב-30 שניות אחרונות: ${s.last30} · ב-5 דקות: ${s.last5m} · מהן 429: ${s.r429} · Retry-After אחרון: ${s.lastRetry ?? '-'} · חסימה נוכחית: ${Math.ceil(rateLimitSecondsLeft())} ש'`,
    ...s.byPath.map(([p, n]) => `${n}× ${p}`),
    '---',
    ...log.slice(-80).map((e) => `${new Date(e.at).toLocaleTimeString('he-IL')} ${e.method} ${e.path} → ${e.status}${e.retryAfter ? ` (Retry-After ${e.retryAfter})` : ''}`),
  ]
  return lines.join('\n')
}

export default function RequestLog() {
  const [, tick] = useState(0)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 2000)
    return () => clearInterval(t)
  }, [])
  const text = logAsText()
  return (
    <section className="space-y-2 rounded-2xl bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">🧾 יומן בקשות לספוטיפיי</h2>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(text).then(() => setCopied(true))
          }}
          className="rounded-lg bg-white/10 px-3 py-1 text-sm"
        >
          {copied ? '✓ הועתק' : '📋 העתקה'}
        </button>
      </div>
      <pre dir="ltr" className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-black/40 p-2 text-left text-[11px] leading-5">{text}</pre>
    </section>
  )
}
