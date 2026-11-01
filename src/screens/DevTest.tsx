// מסך בדיקה לשלב א: התחברות + שליפת שיר עם השנה המקורית. יוחלף במסכי המשחק בהמשך.
import { useEffect, useRef, useState } from 'react'
import { getMe, getMyPlaylists, playlistTotal, type SpotifyPlaylist } from '../spotify/api'
import { logout } from '../spotify/auth'
import { createSongSource, type SongSource, type SourceConfig } from '../songs/sources'
import type { Song } from '../songs/types'

export default function DevTest({ onLogout }: { onLogout: () => void }) {
  const [me, setMe] = useState<string>('')
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([])
  const [selected, setSelected] = useState<string>('')
  const [fromYear, setFrom] = useState(1970)
  const [toYear, setTo] = useState(2020)
  const [genre, setGenre] = useState('')
  const [song, setSong] = useState<Song | null>(null)
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const sourceRef = useRef<{ key: string; src: SongSource } | null>(null)

  useEffect(() => {
    getMe()
      .then((u) => setMe(u.display_name ?? u.id))
      .catch((e) => setError(String(e.message ?? e)))
    getMyPlaylists()
      .then(setPlaylists)
      .catch((e) => setError(String(e.message ?? e)))
  }, [])

  const addLog = (m: string) => setLog((l) => [m, ...l].slice(0, 30))

  const fetchSong = async (config: SourceConfig) => {
    setBusy(true)
    setError(null)
    setSong(null)
    const key = JSON.stringify(config)
    if (sourceRef.current?.key !== key) sourceRef.current = { key, src: createSongSource(config, addLog) }
    try {
      const s = await sourceRef.current.src.next()
      if (!s) setError('לא נמצא שיר מתאים (אולי המקור נגמר)')
      setSong(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-md space-y-5 p-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">בדיקת שלב א</h1>
        <button
          className="rounded-lg bg-white/10 px-3 py-1 text-sm"
          onClick={() => {
            logout()
            onLogout()
          }}
        >
          התנתקות
        </button>
      </header>
      <p className="text-violet-200">{me ? `מחובר כ: ${me}` : 'בודק התחברות…'}</p>

      <section className="space-y-3 rounded-2xl bg-white/5 p-4">
        <h2 className="text-lg font-bold">1. שיר אקראי מספוטיפיי</h2>
        <div className="flex gap-2">
          <label className="flex-1 text-sm">
            משנה
            <input type="number" value={fromYear} onChange={(e) => setFrom(+e.target.value)} className="w-full rounded-lg bg-white/10 p-2" />
          </label>
          <label className="flex-1 text-sm">
            עד שנה
            <input type="number" value={toYear} onChange={(e) => setTo(+e.target.value)} className="w-full rounded-lg bg-white/10 p-2" />
          </label>
        </div>
        <label className="block text-sm">
          ז'אנר (באנגלית, אפשר להשאיר ריק)
          <input dir="ltr" value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="rock" className="w-full rounded-lg bg-white/10 p-2" />
        </label>
        <button
          disabled={busy}
          onClick={() => fetchSong({ kind: 'random', fromYear, toYear, genres: genre.trim() ? [genre.trim()] : [] })}
          className="w-full rounded-xl bg-green-500 py-3 text-lg font-bold text-black disabled:opacity-40"
        >
          הבא שיר אקראי
        </button>
      </section>

      <section className="space-y-3 rounded-2xl bg-white/5 p-4">
        <h2 className="text-lg font-bold">2. שיר מפלייליסט שלי</h2>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-full rounded-lg bg-white/10 p-2">
          <option value="">בחרו פלייליסט ({playlists.length})</option>
          {playlists.map((p) => (
            <option key={p.id} value={p.id} className="text-black">
              {p.name} ({playlistTotal(p)})
            </option>
          ))}
        </select>
        <button
          disabled={busy || !selected}
          onClick={() => fetchSong({ kind: 'playlists', playlistIds: [selected] })}
          className="w-full rounded-xl bg-green-500 py-3 text-lg font-bold text-black disabled:opacity-40"
        >
          הבא שיר מהפלייליסט
        </button>
      </section>

      {busy && <p className="text-center">מחפש שיר ובודק שנה מקורית ב-MusicBrainz…</p>}
      {error && <p className="rounded-xl bg-red-500/20 p-3 text-red-200">{error}</p>}

      {song && (
        <section className="flex gap-4 rounded-2xl bg-white/10 p-4">
          {song.coverUrl && <img src={song.coverUrl} alt="" className="h-24 w-24 rounded-lg" />}
          <div className="space-y-1">
            <div className="text-lg font-bold">{song.name}</div>
            <div className="text-violet-200">{song.artists}</div>
            <div className="text-4xl font-black text-green-400">{song.year}</div>
            <div className="text-xs text-violet-300">
              מקור השנה: {song.yearSource === 'musicbrainz' ? 'MusicBrainz' : 'ספוטיפיי'} · שנה בספוטיפיי: {song.spotifyYear ?? '—'}
              <br />
              אלבום: {song.album} · ISRC: <span dir="ltr">{song.isrc ?? '—'}</span>
            </div>
          </div>
        </section>
      )}

      {log.length > 0 && (
        <section className="rounded-2xl bg-black/30 p-3 text-xs leading-6 text-violet-200">
          <h3 className="mb-1 font-bold">יומן</h3>
          {log.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </section>
      )}
    </main>
  )
}
