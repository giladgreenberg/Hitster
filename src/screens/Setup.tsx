// הגדרות משחק: שחקנים, מקור שירים, טווח שנים, יעד, ועל מה לנגן.
import { useEffect, useState } from 'react'
import { getMyPlaylists, playlistTotal, type SpotifyPlaylist } from '../spotify/api'
import { GENRES } from '../songs/genres'
import type { SongQueue } from '../songs/queue'
import type { GameState, Settings } from '../game/game'
import { startGame } from '../game/startGame'
import { loadSettings, saveSettings } from '../game/storage'
import OutputPicker from '../components/OutputPicker'
import type { Playback } from '../playback/usePlayback'

const MAX_PLAYERS = 8
const thisYear = new Date().getFullYear()

const defaults: Settings = {
  players: ['שחקן 1', 'שחקן 2'],
  source: { kind: 'random', fromYear: 1970, toYear: thisYear, genres: ['pop', 'rock'] },
  targetSongs: 10,
  randomStart: false,
  guessBonus: true,
}

interface Props {
  playback: Playback
  onStart: (game: GameState, queue: SongQueue) => void
  onDebug: () => void
  onLogout: () => void
}

export default function Setup({ playback, onStart, onDebug, onLogout }: Props) {
  const saved = loadSettings()
  const [players, setPlayers] = useState<string[]>(saved?.players ?? defaults.players)
  const [kind, setKind] = useState<'random' | 'playlists'>(saved?.source.kind ?? 'random')
  const [fromYear, setFrom] = useState(saved?.source.kind === 'random' ? saved.source.fromYear : 1970)
  const [toYear, setTo] = useState(saved?.source.kind === 'random' ? saved.source.toYear : thisYear)
  const [genres, setGenres] = useState<string[]>(saved?.source.kind === 'random' ? saved.source.genres : ['pop', 'rock'])
  const [playlistIds, setPlaylistIds] = useState<string[]>(saved?.source.kind === 'playlists' ? saved.source.playlistIds : [])
  const [target, setTarget] = useState(saved?.targetSongs ?? 10)
  const [randomStart, setRandomStart] = useState(saved?.randomStart ?? false)
  const [guessBonus, setGuessBonus] = useState(saved?.guessBonus ?? true)
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[] | null>(null)
  const [starting, setStarting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (kind === 'playlists' && !playlists) {
      getMyPlaylists()
        .then(setPlaylists)
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
    }
  }, [kind, playlists])

  const names = players.map((p, i) => p.trim() || `שחקן ${i + 1}`)
  const problems: string[] = []
  if (kind === 'random' && genres.length === 0) problems.push('בחרו לפחות ז\'אנר אחד')
  if (kind === 'random' && !(fromYear >= 1900 && toYear >= fromYear && toYear <= thisYear)) problems.push('טווח השנים לא תקין')
  if (kind === 'playlists' && playlistIds.length === 0) problems.push('בחרו לפחות פלייליסט אחד')
  if (!playback.mode) problems.push('בחרו על מה לנגן')

  const start = async () => {
    const settings: Settings = {
      players: names,
      source: kind === 'random' ? { kind, fromYear, toYear, genres } : { kind, playlistIds },
      targetSongs: Math.max(2, Math.min(50, target)),
      randomStart,
      guessBonus,
    }
    saveSettings(settings)
    playback.prime()
    setError(null)
    try {
      const { game, queue } = await startGame(settings, setStarting)
      onStart(game, queue)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStarting(null)
    }
  }

  const section = 'space-y-3 rounded-2xl bg-white/5 p-4'
  const toggle = (on: boolean) => `rounded-xl px-4 py-3 text-lg ${on ? 'bg-green-500 font-bold text-black' : 'bg-white/10'}`

  return (
    <main className="mx-auto max-w-md space-y-4 p-4 pb-28">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-black">🎵 משחק חדש</h1>
        <button onClick={onLogout} className="rounded-lg bg-white/10 px-3 py-1 text-sm">
          התנתקות
        </button>
      </header>

      <section className={section}>
        <h2 className="text-xl font-bold">שחקנים</h2>
        {players.map((p, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={p}
              onChange={(e) => setPlayers(players.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={`שחקן ${i + 1}`}
              className="min-w-0 flex-1 rounded-xl bg-white/10 p-3 text-lg outline-none focus:ring-2 focus:ring-green-400"
            />
            {players.length > 1 && (
              <button onClick={() => setPlayers(players.filter((_, j) => j !== i))} className="rounded-xl bg-white/10 px-4 text-xl" aria-label="הסר שחקן">
                ✕
              </button>
            )}
          </div>
        ))}
        {players.length < MAX_PLAYERS && (
          <button onClick={() => setPlayers([...players, ''])} className="w-full rounded-xl border-2 border-dashed border-white/20 py-3 text-lg">
            + הוספת שחקן
          </button>
        )}
      </section>

      <section className={section}>
        <h2 className="text-xl font-bold">מאיפה השירים?</h2>
        <div className="grid grid-cols-2 gap-2">
          <button className={toggle(kind === 'random')} onClick={() => setKind('random')}>
            🎲 אקראי מספוטיפיי
          </button>
          <button className={toggle(kind === 'playlists')} onClick={() => setKind('playlists')}>
            📃 הפלייליסטים שלי
          </button>
        </div>

        {kind === 'random' && (
          <>
            <div className="flex gap-2">
              <label className="flex-1">
                <span className="text-sm text-violet-300">משנה</span>
                <input type="number" inputMode="numeric" value={fromYear} onChange={(e) => setFrom(+e.target.value)} className="w-full rounded-xl bg-white/10 p-3 text-lg" />
              </label>
              <label className="flex-1">
                <span className="text-sm text-violet-300">עד שנה</span>
                <input type="number" inputMode="numeric" value={toYear} onChange={(e) => setTo(+e.target.value)} className="w-full rounded-xl bg-white/10 p-3 text-lg" />
              </label>
            </div>
            <div className="text-sm text-violet-300">ז'אנרים (בכל תור מוגרל אחד מהם)</div>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => {
                const on = genres.includes(g.value)
                return (
                  <button
                    key={g.value}
                    onClick={() => setGenres(on ? genres.filter((x) => x !== g.value) : [...genres, g.value])}
                    className={`rounded-full px-4 py-2 ${on ? 'bg-green-500 font-bold text-black' : 'bg-white/10'}`}
                  >
                    {g.label}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-violet-400">לשירים בעברית: העתיקו פלייליסט ישראלי לחשבון שלכם ובחרו "הפלייליסטים שלי".</p>
          </>
        )}

        {kind === 'playlists' && (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {!playlists && <p className="text-violet-300">טוען פלייליסטים…</p>}
            {playlists?.length === 0 && <p className="text-violet-300">לא נמצאו פלייליסטים בחשבון.</p>}
            {playlists?.map((p) => {
              const on = playlistIds.includes(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => setPlaylistIds(on ? playlistIds.filter((x) => x !== p.id) : [...playlistIds, p.id])}
                  className={`flex w-full items-center gap-3 rounded-xl p-2 text-start ${on ? 'bg-green-500 text-black' : 'bg-white/10'}`}
                >
                  {p.images?.[0]?.url ? <img src={p.images[0].url} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <div className="h-12 w-12 rounded-lg bg-white/10" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{p.name}</div>
                    <div className="text-sm opacity-75">{playlistTotal(p)} שירים</div>
                  </div>
                  <span className="text-xl">{on ? '✓' : ''}</span>
                </button>
              )
            })}
            <p className="text-xs text-violet-400">רואים רק פלייליסטים שבבעלותכם. פלייליסט של מישהו אחר? העתיקו אותו לחשבון שלכם (⋯ ← הוספה לפלייליסט אחר).</p>
          </div>
        )}
      </section>

      <section className={section}>
        <h2 className="text-xl font-bold">חוקים</h2>
        <label className="flex items-center justify-between text-lg">
          <span>שירים לניצחון</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setTarget(Math.max(2, target - 1))} className="h-11 w-11 rounded-xl bg-white/10 text-2xl">
              −
            </button>
            <span className="w-8 text-center text-2xl font-bold">{target}</span>
            <button onClick={() => setTarget(Math.min(50, target + 1))} className="h-11 w-11 rounded-xl bg-white/10 text-2xl">
              +
            </button>
          </div>
        </label>
        <label className="flex items-center justify-between gap-3 text-lg">
          <span>
            משחק עם אסימונים 🪙
            <span className="block text-xs text-violet-400">כל אחד מתחיל עם 2 (עד 5). ניחוש שם ואמן = +1. דילוג או אתגר = 1, קניית שיר = 3</span>
          </span>
          <input type="checkbox" checked={guessBonus} onChange={(e) => setGuessBonus(e.target.checked)} className="h-6 w-6 shrink-0" />
        </label>
        <label className="flex items-center justify-between gap-3 text-lg">
          <span>
            התחלה מנקודה אקראית בשיר
            <span className="block text-xs text-violet-400">קשה יותר – לא מתחילים מהפתיחה המוכרת</span>
          </span>
          <input type="checkbox" checked={randomStart} onChange={(e) => setRandomStart(e.target.checked)} className="h-6 w-6 shrink-0" />
        </label>
      </section>

      <section className={section}>
        <h2 className="text-xl font-bold">על מה לנגן?</h2>
        <OutputPicker playback={playback} />
      </section>

      {error && <p className="rounded-xl bg-red-500/20 p-3 text-red-200">{error}</p>}

      <button onClick={onDebug} className="w-full text-center text-sm text-violet-400 underline">
        מסך בדיקות
      </button>

      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-[#0f0a1e] via-[#0f0a1e] to-transparent p-4 pt-8">
        <div className="mx-auto max-w-md">
          {problems.length > 0 && !starting && <p className="mb-2 text-center text-sm text-amber-300">{problems[0]}</p>}
          <button
            onClick={start}
            disabled={problems.length > 0 || !!starting}
            className="w-full rounded-2xl bg-green-500 py-4 text-2xl font-black text-black shadow-xl active:scale-95 disabled:opacity-40"
          >
            {starting ?? 'יאללה, מתחילים! 🎶'}
          </button>
        </div>
      </div>
    </main>
  )
}
