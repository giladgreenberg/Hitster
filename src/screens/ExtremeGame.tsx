// מצב אקסטרים: שתי קבוצות, ציר משותף, 3 לבבות לכל קבוצה.
import { useEffect, useReducer, useRef, useState } from 'react'
import { extremeReducer, type ExtremeAction, type ExtremeState } from '../game/extreme'
import { saveGame } from '../game/storage'
import { createSongQueue, type SongQueue } from '../songs/queue'
import { addToBlacklist } from '../songs/blacklist'
import type { Song } from '../songs/types'
import type { Playback } from '../playback/usePlayback'
import Timeline from '../components/Timeline'
import FlipCard from '../components/FlipCard'
import PlayerControls from '../components/PlayerControls'
import Lives from '../components/Lives'
import Podium from '../components/Podium'
import StatsPanel from '../components/StatsPanel'
import YearGuess, { ExactGuessResult } from '../components/YearGuess'
import { parseYearGuess } from '../game/bonus'

interface Props {
  initial: ExtremeState
  initialQueue: SongQueue | null
  playback: Playback
  onNewGame: () => void
  onRematch: () => void
}

const TEAM_COLORS = ['from-sky-500/30 ring-sky-400', 'from-rose-500/30 ring-rose-400'] as const

export default function ExtremeGame({ initial, initialQueue, playback, onNewGame, onRematch }: Props) {
  const [game, dispatch] = useReducer(extremeReducer, initial)
  const queueRef = useRef<SongQueue | null>(initialQueue)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const [endStep, setEndStep] = useState<'podium' | 'stats'>('podium')
  const [podiumDone, setPodiumDone] = useState(false)
  const [guess, setGuess] = useState('')
  const exactOn = game.settings.exactYear !== false
  // שיר חדש = שדה ניחוש ריק
  useEffect(() => setGuess(''), [game.song?.id])
  // "השמעת קטע בלבד"
  useEffect(() => playback.setClipSeconds(game.settings.playLimit ?? 0), [game.settings.playLimit, playback.setClipSeconds])

  if (!queueRef.current) queueRef.current = createSongQueue(game.settings.source, game.usedIds, 4)
  useEffect(() => queueRef.current?.warmUp(), [])
  useEffect(() => saveGame(game.phase === 'over' ? null : game), [game])

  const team = game.teams[game.current]

  const withNewSong = async (make: (song: Song) => ExtremeAction) => {
    playback.prime()
    playback.reset()
    setLoading(true)
    setError(null)
    try {
      const song = await queueRef.current!.take()
      if (!song) {
        setError('נגמרו השירים במקור שנבחר')
        return
      }
      dispatch(make(song))
      await playback.playSong(song, game.settings.randomStart)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  // לוח הקבוצות – תמיד גלוי
  const scoreboard = (
    <div className="grid grid-cols-2 gap-2">
      {game.teams.map((t, i) => (
        <div
          key={i}
          className={`rounded-2xl bg-gradient-to-b to-transparent p-2 text-center ${TEAM_COLORS[i]} ${i === game.current && game.phase !== 'over' ? 'ring-2' : 'opacity-70'}`}
        >
          <div className="truncate text-lg font-bold">{t.name}</div>
          <Lives lives={t.lives} />
          <div className="text-xs text-violet-200">✓ {t.correct} נכונים</div>
        </div>
      ))}
    </div>
  )

  if (game.phase === 'over') {
    const w = game.winner !== null ? game.teams[game.winner] : null
    const ranked = game.winner === 1 ? [game.teams[1], game.teams[0]] : [game.teams[0], game.teams[1]]
    if (endStep === 'podium') {
      return (
        <main className="mx-auto flex min-h-full max-w-md flex-col gap-6 p-4 text-center">
          <h1 className="pt-4 text-3xl font-black">{w ? `${w.name} ניצחו! 🏆` : 'תיקו! 🤝'}</h1>
          <Podium entries={ranked.map((t) => ({ name: t.name, score: `✓ ${t.correct} נכונים`, sub: `${'❤️'.repeat(t.lives)}${'🖤'.repeat(3 - t.lives)}` }))} onDone={() => setPodiumDone(true)} />
          <p className="text-violet-200">
            הציר המשותף הגיע ל-{game.timeline.length} שירים אחרי {game.turn} תורות
          </p>
          <div className={`mt-auto space-y-2 transition-opacity ${podiumDone ? '' : 'pointer-events-none opacity-0'}`}>
            <button onClick={() => setEndStep('stats')} className="w-full rounded-2xl bg-violet-500 py-4 text-xl font-black active:scale-95">
              📊 סטטיסטיקות והציר המשותף
            </button>
            <button onClick={onRematch} className="w-full rounded-2xl bg-green-500 py-4 text-2xl font-black text-black active:scale-95">
              🔁 עוד משחק
            </button>
            <button onClick={onNewGame} className="w-full rounded-2xl bg-white/10 py-3 text-lg">
              ⚙️ הגדרות
            </button>
          </div>
        </main>
      )
    }
    return (
      <main className="mx-auto max-w-md space-y-5 p-4 text-center">
        <div className="flex items-center justify-between pt-2">
          <h1 className="text-3xl font-black">📊 סיכום המשחק</h1>
          <button onClick={() => setEndStep('podium')} className="rounded-lg bg-white/10 px-3 py-2">
            → חזרה
          </button>
        </div>
        {scoreboard}
        <StatsPanel events={game.events} actors={game.teams.map((t) => t.name)} />
        <div className="text-start">
          <p className="mb-1 text-sm text-violet-300">הציר המשותף ({game.timeline.length} שירים):</p>
          <Timeline timeline={game.timeline} longTools />
        </div>
        <button onClick={onRematch} className="w-full rounded-2xl bg-green-500 py-4 text-2xl font-black text-black active:scale-95">
          🔁 עוד משחק
        </button>
        <button onClick={onNewGame} className="w-full rounded-2xl bg-white/10 py-4 text-xl">
          ⚙️ הגדרות
        </button>
      </main>
    )
  }

  const revealed = game.phase === 'reveal'
  const result = game.result

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <div className="text-sm text-violet-300">
          🔥 אקסטרים · תור {game.turn} · {game.timeline.length} שירים בציר
        </div>
        <button onClick={() => setMenu(!menu)} className="rounded-xl bg-white/10 px-3 py-2 text-lg" aria-label="תפריט">
          ⋯
        </button>
      </header>

      {menu && (
        <div className="space-y-2 rounded-2xl bg-white/5 p-3">
          <button
            onClick={() => {
              setMenu(false)
              playback.stop()
              dispatch({ type: 'end' })
            }}
            className="w-full rounded-xl bg-white/10 py-3"
          >
            🏁 סיום המשחק עכשיו
          </button>
          <button
            onClick={() => {
              if (confirm('לצאת מהמשחק? המשחק הנוכחי יימחק.')) {
                playback.stop()
                saveGame(null)
                onNewGame()
              }
            }}
            className="w-full rounded-xl bg-white/10 py-3"
          >
            ⚙️ משחק חדש / הגדרות
          </button>
        </div>
      )}

      {scoreboard}

      {game.phase === 'pass' && (
        <section className="flex flex-1 flex-col items-center justify-center gap-5 py-4 text-center">
          <h2 className="text-3xl font-black leading-tight">תור {team.name}!</h2>
          <p className="text-violet-200">הציר המשותף:</p>
          <div className="w-full text-start">
            <Timeline timeline={game.timeline} longTools />
          </div>
          <button
            onClick={() => withNewSong((song) => ({ type: 'beginTurn', song, at: Date.now() }))}
            disabled={loading}
            className="w-full rounded-2xl bg-green-500 py-5 text-2xl font-black text-black shadow-xl active:scale-95 disabled:opacity-50"
          >
            {loading ? 'טוען שיר…' : `${team.name} – יאללה! ▶`}
          </button>
        </section>
      )}

      {(game.phase === 'listen' || revealed) && (
        <>
          <FlipCard song={game.song} revealed={revealed} correct={revealed ? (result?.correct ?? null) : null} />
          {!revealed && <PlayerControls playback={playback} onPlay={() => game.song && playback.playSong(game.song, game.settings.randomStart)} />}

          {revealed && result && (
            <div className={`pop-in rounded-2xl p-3 text-center text-xl font-bold ${result.correct ? 'bg-green-500/25 text-green-200' : 'bg-red-500/25 text-red-200'}`}>
              {result.correct
                ? `🎉 נכון! השיר נכנס לציר${result.lifeRestored ? ' · ❤️ שנה מדויקת – חזר לב!' : ''}`
                : result.eliminated
                  ? `💔 טעות – ${team.name} נפסלו!`
                  : `💔 טעות – השיר יצא ב-${game.song?.year}. ${team.name} איבדו לב`}
            </div>
          )}

          {revealed && result && game.song && (
            <ExactGuessResult
              guess={exactOn ? parseYearGuess(guess) : null}
              year={game.song.year}
              hit={result.exactHit}
              reward={result.lifeRestored ? '❤️ חזר לב!' : 'כל הכבוד! (הלבבות כבר מלאים)'}
            />
          )}

          <div>
            {!revealed && <p className="text-center text-violet-200">{game.slot === null ? `👇 ${team.name}, לחצו על + במקום הנכון בציר` : 'אפשר לשנות מיקום'}</p>}
            <Timeline
              timeline={game.timeline}
              selectable={!revealed}
              selectedSlot={revealed ? null : game.slot}
              onSelect={(slot) => dispatch({ type: 'select', slot })}
              highlightId={revealed && result?.correct ? game.song?.id : null}
              longTools
            />
          </div>

          {!revealed && exactOn && <YearGuess value={guess} onChange={setGuess} reward="❤️ חוזר לב שאבד" />}
          {!revealed && (
            <button
              onClick={() => dispatch({ type: 'reveal', at: Date.now(), exactGuess: exactOn ? parseYearGuess(guess) : null })}
              disabled={game.slot === null || loading}
              className="w-full rounded-2xl bg-violet-500 py-5 text-2xl font-black shadow-xl active:scale-95 disabled:opacity-40"
            >
              🃏 חשוף!
            </button>
          )}

          {revealed && (
            <>
              <button
                onClick={() => {
                  playback.stop()
                  playback.reset()
                  dispatch({ type: 'next' })
                }}
                className="w-full rounded-2xl bg-green-500 py-5 text-2xl font-black text-black shadow-xl active:scale-95"
              >
                {game.winner !== null ? '🏆 לתוצאות' : `תור ${game.teams[game.current === 0 ? 1 : 0].name} ▶`}
              </button>
              <button
                onClick={() => {
                  if (game.song) addToBlacklist(game.song.id)
                  withNewSong((song) => ({ type: 'wrongYear', song }))
                }}
                disabled={loading}
                className="w-full py-2 text-sm text-violet-300 underline"
              >
                ⚠️ השנה שגויה? (מבטל את התור בלי עונש, ומביא שיר אחר)
              </button>
            </>
          )}
        </>
      )}

      {error && <p className="rounded-xl bg-red-500/20 p-3 text-red-200">{error}</p>}
    </main>
  )
}
