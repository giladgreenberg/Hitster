// מצב סולו: שחקן אחד, שעון עצר, טעות אחת ונגמר. בסוף – טבלת שיאים.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { soloReducer, soloSeconds, type SoloAction, type SoloState } from '../game/solo'
import { saveGame } from '../game/storage'
import { bestScore, categoryOf, CATEGORY_LABELS, saveScore } from '../game/highscores'
import { createSongQueue, type SongQueue } from '../songs/queue'
import { addToBlacklist } from '../songs/blacklist'
import type { Song } from '../songs/types'
import type { Playback } from '../playback/usePlayback'
import Timeline from '../components/Timeline'
import FlipCard from '../components/FlipCard'
import PlayerControls from '../components/PlayerControls'
import Countdown from '../components/Countdown'
import Confetti from '../components/Confetti'
import { ScoreTable } from './HighScores'

interface Props {
  initial: SoloState
  initialQueue: SongQueue | null
  playback: Playback
  onNewGame: () => void
  onRematch: () => void
}

export default function SoloGame({ initial, initialQueue, playback, onNewGame, onRematch }: Props) {
  const [game, dispatch] = useReducer(soloReducer, initial)
  const queueRef = useRef<SongQueue | null>(initialQueue)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [final, setFinal] = useState<{ rank: number | null; isRecord: boolean; date: string } | null>(null)
  const category = categoryOf(game.settings)
  const [best] = useState(() => bestScore(category))

  if (!queueRef.current) queueRef.current = createSongQueue(game.settings.source, game.usedIds, 4)
  useEffect(() => queueRef.current?.warmUp(), [])
  useEffect(() => saveGame(game.phase === 'over' ? null : game), [game])

  /** מנגן, ורק כשהשיר באמת התחיל – מפעיל את השעון */
  const playAndStartTimer = async (song: Song) => {
    const ok = await playback.playSong(song, game.settings.randomStart)
    if (ok) dispatch({ type: 'timerStart', at: Date.now() })
  }

  const withNewSong = async (make: (song: Song) => SoloAction) => {
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
      await playAndStartTimer(song)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const onTimeout = useCallback(() => {
    playback.stop()
    dispatch({ type: 'timeout', at: Date.now() })
  }, [playback])

  const reveal = () => dispatch({ type: 'reveal', at: Date.now() })

  const finish = () => {
    playback.stop()
    playback.reset()
    const date = new Date().toISOString()
    const res = saveScore({ name: game.name, score: game.score, date, category })
    setFinal({ rank: res.rank, isRecord: res.isRecord, date })
    dispatch({ type: 'finish' })
  }

  // ---------- מסך סיום ----------
  if (game.phase === 'over') {
    const record = final?.isRecord
    return (
      <main className="mx-auto max-w-md space-y-5 p-4 text-center">
        {record && <Confetti count={120} />}
        <div className="pop-in pt-6 text-8xl">{record ? '🏆' : '🎵'}</div>
        <h1 className="text-4xl font-black">{record ? 'שיא חדש!!!' : 'המשחק נגמר'}</h1>
        <div>
          <div className="text-7xl font-black text-green-400">{game.score}</div>
          <div className="text-violet-200">נקודות · {CATEGORY_LABELS[category]}</div>
        </div>
        {record && best > 0 && <p className="text-lg text-amber-200">שברת את השיא הקודם ({best})! 🎉</p>}
        {!record && final?.rank !== null && final?.rank !== undefined && <p className="text-lg text-amber-200">נכנסת לטבלה במקום {final.rank + 1}!</p>}
        <div className="rounded-2xl bg-white/5 p-3 text-start">
          <h2 className="mb-2 text-lg font-bold">🏆 טבלת שיאים – {CATEGORY_LABELS[category]}</h2>
          <ScoreTable category={category} highlightDate={final?.date} />
        </div>
        <div className="text-start">
          <p className="mb-1 text-sm text-violet-300">הציר שלך:</p>
          <Timeline timeline={game.timeline} compact />
        </div>
        <button onClick={onRematch} className="w-full rounded-2xl bg-green-500 py-4 text-2xl font-black text-black active:scale-95">
          🔁 עוד סיבוב
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
        <div>
          <div className="text-2xl font-black">⏱️ {game.name}</div>
          <div className="text-sm text-violet-300">
            שיר {game.turn} · שיא: {best}
          </div>
        </div>
        <div className="text-center">
          <div className="text-4xl font-black text-green-400">{game.score}</div>
          <div className="text-xs text-violet-300">נקודות</div>
        </div>
      </header>

      {game.phase === 'ready' && (
        <section className="flex flex-1 flex-col items-center justify-center gap-6 py-6 text-center">
          <h2 className="text-3xl font-black">מוכנים?</h2>
          <p className="text-violet-200">
            יש לכם {soloSeconds(game)} שניות למקם כל שיר. טעות אחת – ונגמר.
          </p>
          <Timeline timeline={game.timeline} compact />
          <button
            onClick={() => withNewSong((song) => ({ type: 'beginTurn', song }))}
            disabled={loading}
            className="w-full rounded-2xl bg-green-500 py-5 text-2xl font-black text-black shadow-xl active:scale-95 disabled:opacity-50"
          >
            {loading ? 'טוען שיר…' : '▶ יאללה!'}
          </button>
        </section>
      )}

      {(game.phase === 'listen' || revealed) && (
        <>
          {game.phase === 'listen' && <Countdown startedAt={game.timerStartedAt} seconds={soloSeconds(game)} onExpire={onTimeout} />}

          <FlipCard song={game.song} revealed={revealed} correct={revealed ? (result?.correct ?? null) : null} />

          {!revealed && <PlayerControls playback={playback} onPlay={() => game.song && playAndStartTimer(game.song)} />}

          {revealed && result && (
            <div className={`pop-in rounded-2xl p-3 text-center text-xl font-bold ${result.correct ? 'bg-green-500/25 text-green-200' : 'bg-red-500/25 text-red-200'}`}>
              {result.timeout
                ? `⏰ נגמר הזמן! השיר יצא ב-${game.song?.year}`
                : result.correct
                  ? `🎉 נכון! +${result.points}${result.exactHit ? ' (כולל בונוס שנה מדויקת!)' : ''}`
                  : `❌ לא נכון – השיר יצא ב-${game.song?.year}`}
            </div>
          )}

          {game.phase === 'listen' ? (
            <div>
              <p className="text-center text-violet-200">{game.slot === null ? '👇 לחצו על + כדי למקם את השיר' : 'אפשר לשנות מיקום'}</p>
              <Timeline timeline={game.timeline} selectable selectedSlot={game.slot} onSelect={(slot) => dispatch({ type: 'select', slot })} />
            </div>
          ) : (
            <Timeline timeline={game.timeline} highlightId={result?.correct ? game.song?.id : null} />
          )}

          {game.phase === 'listen' && (
            <button
              onClick={reveal}
              disabled={game.slot === null || loading}
              className="w-full rounded-2xl bg-violet-500 py-5 text-2xl font-black shadow-xl active:scale-95 disabled:opacity-40"
            >
              🃏 חשוף!
            </button>
          )}

          {revealed && result && (
            <>
              {result.gameOver ? (
                <button onClick={finish} className="w-full rounded-2xl bg-amber-400 py-5 text-2xl font-black text-black shadow-xl active:scale-95">
                  🏁 לתוצאות
                </button>
              ) : (
                <button
                  onClick={() => withNewSong((song) => ({ type: 'beginTurn', song }))}
                  disabled={loading}
                  className="w-full rounded-2xl bg-green-500 py-5 text-2xl font-black text-black shadow-xl active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'טוען שיר…' : 'לשיר הבא ▶'}
                </button>
              )}
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
      {game.phase !== 'ready' && (
        <button
          onClick={() => {
            if (confirm('לצאת מהמשחק? התוצאה לא תישמר.')) {
              playback.stop()
              saveGame(null)
              onNewGame()
            }
          }}
          className="mt-auto py-2 text-sm text-violet-400 underline"
        >
          יציאה מהמשחק
        </button>
      )}
    </main>
  )
}
