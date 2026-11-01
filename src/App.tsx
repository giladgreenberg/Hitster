import { useEffect, useState } from 'react'
import { handleCallback, isLoggedIn } from './spotify/auth'
import Login from './screens/Login'
import DevTest from './screens/DevTest'

type View = 'loading' | 'login' | 'app'

export default function App() {
  const [view, setView] = useState<View>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (window.location.pathname === '/callback') {
      handleCallback().then((err) => {
        window.history.replaceState(null, '', '/')
        setError(err)
        setView(err ? 'login' : 'app')
      })
    } else {
      setView(isLoggedIn() ? 'app' : 'login')
    }
  }, [])

  if (view === 'loading') return <div className="p-8 text-center text-xl">טוען…</div>
  if (view === 'login') return <Login error={error} />
  return <DevTest onLogout={() => setView('login')} />
}
