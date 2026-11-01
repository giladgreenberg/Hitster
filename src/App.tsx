import { useEffect, useState } from 'react'
import { handleCallback, isLoggedIn, logout } from './spotify/auth'
import { usePlayback } from './playback/usePlayback'
import type { GameState } from './game/game'
import type { SongQueue } from './songs/queue'
import { loadGame, loadSettings, saveGame } from './game/storage'
import { startGame } from './game/startGame'
import Login from './screens/Login'
import Setup from './screens/Setup'
import Game from './screens/Game'
import DevTest from './screens/DevTest'

type View =
  | { name: 'loading'; msg?: string }
  | { name: 'login' }
  | { name: 'setup' }
  | { name: 'game'; game: GameState; queue: SongQueue | null; key: number }
  | { name: 'debug' }

export default function App() {
  const [view, setView] = useState<View>({ name: 'loading' })
  const [error, setError] = useState<string | null>(null)
  const playback = usePlayback()

  const afterLogin = () => {
    const saved = loadGame()
    setView(saved ? { name: 'game', game: saved, queue: null, key: Date.now() } : { name: 'setup' })
  }

  useEffect(() => {
    if (window.location.pathname === '/callback') {
      handleCallback().then((err) => {
        window.history.replaceState(null, '', '/')
        setError(err)
        if (err) setView({ name: 'login' })
        else afterLogin()
      })
    } else if (isLoggedIn()) afterLogin()
    else setView({ name: 'login' })
  }, [])

  const doLogout = () => {
    logout()
    setView({ name: 'login' })
  }

  const rematch = async () => {
    const settings = loadSettings()
    if (!settings) return setView({ name: 'setup' })
    playback.prime()
    try {
      const { game, queue } = await startGame(settings, (msg) => setView({ name: 'loading', msg }))
      setView({ name: 'game', game, queue, key: Date.now() })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setView({ name: 'setup' })
    }
  }

  switch (view.name) {
    case 'loading':
      return <div className="flex min-h-full items-center justify-center p-8 text-center text-2xl">{view.msg ?? 'טוען…'}</div>
    case 'login':
      return <Login error={error} />
    case 'debug':
      return (
        <div>
          <button onClick={() => setView({ name: 'setup' })} className="m-4 rounded-lg bg-white/10 px-3 py-1">
            → חזרה
          </button>
          <DevTest onLogout={doLogout} />
        </div>
      )
    case 'setup':
      return (
        <Setup
          playback={playback}
          onStart={(game, queue) => setView({ name: 'game', game, queue, key: Date.now() })}
          onDebug={() => setView({ name: 'debug' })}
          onLogout={doLogout}
        />
      )
    case 'game':
      return (
        <Game
          key={view.key}
          initial={view.game}
          initialQueue={view.queue}
          playback={playback}
          onNewGame={() => {
            saveGame(null)
            setView({ name: 'setup' })
          }}
          onRematch={rematch}
        />
      )
  }
}
