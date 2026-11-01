// מסך המשחק: העברת טלפון ← האזנה ומיקום ← חשיפה ← הבא.
import { useEffect, useReducer, useRef, useState } from 'react'
import { gameReducer, TOKEN_COST, type Action, type GameState } from '../game/game'
import { saveGame } from '../game/storage'
import { createSongQueue, type SongQueue } from '../songs/queue'
import { addToBlacklist } from '../songs/blacklist'
import type { Song } from '../songs/types'
import type { Playback } from '../playback/usePlayback'
import Timeline from '../components/Timeline'
import FlipCard from '../components/FlipCard'
import PlayerControls from '../components/PlayerControls'
import Scoreboard from '../components/Scoreboard'
import GameOver from './GameOver'

interface Props {
  initial: GameState
  initialQueue: SongQueue | null
  playback: Playback
  onNewGame: () => void
  onRematch: () => void
}

export default function Game({ initial, initialQueue, playback, onNewGame, onRematch }: Props) {
  const [game, dispatch] = useReducer(gameReducer, initial)
  const queueRef = useRef<SongQueue | null>(initialQueue)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outOfSongs, setOutOfSongs] = useState(false)
  const [showScores, setShowScores] = useState(false)
  const [menu, setMenu] = useState(false)

  // תור שירים: אם חזרנו ממשחק שמור – יוצרים חדש ומסמנים את השירים שכבר היו
  if (!queueRef.current) queueRef.current = createSongQueue(game.settings.source, game.usedIds, 4)

  useEffect(() => {
    queueRef.current?.warmUp()
  }, [])

  // שמירה אחרי כל שינוי
  useEffect(() => {
    saveGame(game.phase === 'over' ? null : game)
  }, [game])

  const player = game.players[game.current]
  const single = game.players.length === 1

  /** מביא שיר מהתור, שולח פעולה, ומנגן */
  const withNewSong = async (make: (song: Song) => Action) => {
    playback.prime() // חייב לקרות מיד בלחיצה
    playback.reset()
    setLoading(true)
    setError(null)
    try {
      const song = await queueRef.current!.take()
      if (!song) {
        setOutOfSongs(true)
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

  const reveal = () => dispatch({ type: 'reveal' })

  const next = () => {
    playback.stop()
    playback.reset()
    dispatch({ type: 'next' })
  }

  const wrongYear = () => {
    if (game.song) addToBlacklist(game.song.id)
    withNewSong((song) => ({ type: 'wrongYear', song }))
  }

  if (game.phase === 'over') {
    return <GameOver game={game} onNewGame={onNewGame} onRematch={onRematch} />
  }

  const result = game.result
  const revealed = game.phase === 'reveal'

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col gap-4 p-4">
      {/* כותרת */}
      <header className="flex items-center justify-between gap-2">
        <div>
          <div className="text-2xl font-black">{player.name}</div>
          <div className="text-sm text-violet-300">
            🎵 {player.timeline.length}/{game.settings.targetSongs}
            {game.settings.guessBonus && <span className="ms-3">🪙 {player.tokens}</span>}
            <span className="ms-3">תור {game.turn}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowScores(true)} className="rounded-xl bg-white/10 px-3 py-2 text-lg" aria-label="לוח ניקוד">
            📊
          </button>
          <button onClick={() => setMenu(!menu)} className="rounded-xl bg-white/10 px-3 py-2 text-lg" aria-label="תפריט">
            ⋯
          </button>
        </div>
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

      {outOfSongs && (
        <div className="space-y-2 rounded-2xl bg-amber-500/20 p-4 text-center">
          <p>נגמרו השירים במקור שנבחר 🙈</p>
          <button onClick={() => dispatch({ type: 'end' })} className="w-full rounded-xl bg-amber-400 py-3 font-bold text-black">
            סיום המשחק
          </button>
        </div>
      )}

      {/* מסך העברה */}
      {game.phase === 'pass' && (
        <section className="flex flex-1 flex-col items-center justify-center gap-6 py-6 text-center">
          {!single && <div className="text-6xl">🤝📱</div>}
          <h2 className="text-3xl font-black leading-tight">{single ? 'מוכנים לשיר הבא?' : `העבירו את הטלפון ל${player.name}`}</h2>
          <Timeline timeline={player.timeline} compact />
          <button
            onClick={() => withNewSong((song) => ({ type: 'beginTurn', song }))}
            disabled={loading}
            className="w-full rounded-2xl bg-green-500 py-5 text-2xl font-black text-black shadow-xl active:scale-95 disabled:opacity-50"
          >
            {loading ? 'טוען שיר…' : single ? '▶ לשיר הבא' : `אני ${player.name} – יאללה! ▶`}
          </button>
        </section>
      )}

      {/* האזנה + מיקום / חשיפה */}
      {(game.phase === 'listen' || revealed) && (
        <>
          <FlipCard song={game.song} revealed={revealed} correct={revealed ? (result?.correct ?? null) : null} />

          {!revealed && <PlayerControls playback={playback} onPlay={() => game.song && playback.playSong(game.song, game.settings.randomStart)} />}

          {revealed && result && (
            <div className={`pop-in rounded-2xl p-3 text-center text-xl font-bold ${result.correct ? 'bg-green-500/25 text-green-200' : 'bg-red-500/25 text-red-200'}`}>
              {result.how === 'bought' ? '🪙 קנית את השיר – הוא נכנס לציר!' : result.correct ? '🎉 נכון! השיר נכנס לציר' : `❌ לא נכון – השיר יצא ב-${game.song?.year}`}
            </div>
          )}

          <div>
            {!revealed && (
              <p className="text-center text-violet-200">{game.slot === null ? '👇 לחצו על + כדי למקם את השיר בציר' : 'אפשר לשנות מיקום, ואז לחשוף'}</p>
            )}
            <Timeline
              timeline={player.timeline}
              selectable={!revealed}
              selectedSlot={revealed ? null : game.slot}
              onSelect={(slot) => dispatch({ type: 'select', slot })}
              highlightId={revealed && result?.correct ? game.song?.id : null}
            />
          </div>

          {!revealed && (
            <>
              {game.settings.guessBonus && <p className="text-center text-sm text-violet-300">💡 בונוס: אמרו בקול את שם השיר והאמן לפני החשיפה</p>}
              <button
                onClick={reveal}
                disabled={game.slot === null || loading}
                className="w-full rounded-2xl bg-violet-500 py-5 text-2xl font-black shadow-xl active:scale-95 disabled:opacity-40"
              >
                🃏 חשוף!
              </button>
              {game.settings.guessBonus && player.tokens >= TOKEN_COST && (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => withNewSong((song) => ({ type: 'skip', song }))} disabled={loading} className="rounded-xl bg-amber-500/20 py-3 text-amber-100">
                    ⏭ דילוג (🪙{TOKEN_COST})
                  </button>
                  <button onClick={() => dispatch({ type: 'buy' })} disabled={loading} className="rounded-xl bg-amber-500/20 py-3 text-amber-100">
                    🛒 קניית השיר (🪙{TOKEN_COST})
                  </button>
                </div>
              )}
            </>
          )}

          {revealed && result && (
            <>
              {game.settings.guessBonus && result.how === 'placed' && result.guessed === null && (
                <div className="rounded-2xl bg-white/5 p-3">
                  <p className="mb-2 text-center">האם {player.name} ניחש/ה נכון את שם השיר והאמן?</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => dispatch({ type: 'guess', correct: true })} className="rounded-xl bg-green-600 py-3 text-lg font-bold">
                      ✓ צדק (+🪙)
                    </button>
                    <button onClick={() => dispatch({ type: 'guess', correct: false })} className="rounded-xl bg-white/10 py-3 text-lg">
                      ✗ טעה / לא ניחש
                    </button>
                  </div>
                </div>
              )}
              {result.guessed === true && <p className="text-center text-amber-200">🪙 קיבלת אסימון!</p>}

              <button onClick={next} className="w-full rounded-2xl bg-green-500 py-5 text-2xl font-black text-black shadow-xl active:scale-95">
                {game.winner !== null ? '🏆 לתוצאות' : single ? 'המשך ▶' : 'לשחקן הבא ▶'}
              </button>
              <button onClick={wrongYear} disabled={loading} className="w-full py-2 text-sm text-violet-300 underline">
                ⚠️ השנה שגויה? (מבטל את התור בלי עונש, ומביא שיר אחר)
              </button>
            </>
          )}
        </>
      )}

      {error && <p className="rounded-xl bg-red-500/20 p-3 text-red-200">{error}</p>}
      {showScores && <Scoreboard game={game} onClose={() => setShowScores(false)} />}
    </main>
  )
}
