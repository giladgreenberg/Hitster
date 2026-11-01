import { useState } from 'react'
import { clientIdFromEnv, getClientId, getRedirectUri, setClientId, startLogin } from '../spotify/auth'

export default function Login({ error }: { error: string | null }) {
  const [clientId, setId] = useState(getClientId())
  const fromEnv = clientIdFromEnv()

  const login = () => {
    if (!fromEnv) setClientId(clientId)
    startLogin()
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-5xl font-black tracking-tight">🎵 היטסטר</h1>
      <p className="text-lg text-violet-200">נחשו מתי יצא השיר ובנו את ציר הזמן שלכם</p>

      {!fromEnv && (
        <label className="w-full text-start">
          <span className="mb-1 block text-sm text-violet-300">Client ID מ-Spotify Developer Dashboard</span>
          <input
            dir="ltr"
            value={clientId}
            onChange={(e) => setId(e.target.value)}
            placeholder="למשל 1a2b3c4d…"
            className="w-full rounded-xl bg-white/10 p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-green-400"
          />
        </label>
      )}

      <button
        onClick={login}
        disabled={!clientId.trim()}
        className="w-full rounded-2xl bg-green-500 py-4 text-xl font-bold text-black active:scale-95 disabled:opacity-40"
      >
        התחברות עם ספוטיפיי
      </button>

      {error && <p className="rounded-xl bg-red-500/20 p-3 text-red-200">{error}</p>}

      <p className="text-xs text-violet-400">
        כתובת ה-Redirect URI שצריכה להיות רשומה באפליקציה בספוטיפיי:
        <br />
        <code dir="ltr" className="select-all">{getRedirectUri()}</code>
      </p>
    </main>
  )
}
