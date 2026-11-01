// מסך המשחק: העברת טלפון ← האזנה ומיקום ← חשיפה ← הבא.
import ErrorBox from '../components/ErrorBox'
import { useEffect, useReducer, useRef, useState } from 'react'
import { BUY_COST, CHALLENGE_COST, eligibleChallengers, gameReducer, SKIP_COST, type Action, type GameState } from '../game/game'
import { saveGame } from '../game/storage'
import { createSongQueue, type SongQueue } from '../songs/queue'
import { addToBlacklist } from '../songs/blacklist'
import type { Song } from '../songs/types'
import type { Playback } from '../playback/usePlayback'
import Timeline from '../components/Timeline'
import FlipCard from '../components/FlipCard'
import PlayerControls from '../components/PlayerControls'
import Scoreboard from '../components/Scoreboard'
import YearGuess, { ExactGuessResult } from '../components/YearGuess'
import { parseYearGuess } from '../game/bonus'
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
  const [guess, setGuess] = useState('')
  const exactOn = game.settings.exactYear !== false
  // שיר חדש = שדה ניחוש ריק
  useEffect(() => setGuess(''), [game.song?.id])
  // "השמעת קטע בלבד"
  useEffect(() => playback.setClipSeconds(game.settings.playLimit ?? 0), [game.settings.playLimit, playback.setClipSeconds])

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

  const reveal = () => dispatch({ type: 'reveal', at: Date.now(), exactGuess: exactOn ? parseYearGuess(guess) : null })

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

      {/* האזנה + מיקום / אתגר / חשיפה */}
      {(game.phase === 'listen' || game.phase === 'challenge' || revealed) && (
        <>
          <FlipCard song={game.song} revealed={revealed} correct={revealed ? (result?.correct ?? null) : null} />

          {!revealed && <PlayerControls playback={playback} onPlay={() => game.song && playback.playSong(game.song, game.settings.randomStart)} />}

          {revealed && result && (
            <div className={`pop-in rounded-2xl p-3 text-center text-xl font-bold ${result.correct ? 'bg-green-500/25 text-green-200' : 'bg-red-500/25 text-red-200'}`}>
              {result.how === 'bought' ? '🪙 קנית את השיר – הוא נכנס לציר!' : result.correct ? '🎉 נכון! השיר נכנס לציר' : `❌ לא נכון – השיר יצא ב-${game.song?.year}`}
            </div>
          )}

          {revealed && result && result.how === 'placed' && game.song && (
            <ExactGuessResult guess={result.exactGuess} year={game.song.year} hit={!!result.exactHit} reward={game.settings.guessBonus ? '+🪙 אסימון' : 'כל הכבוד!'} />
          )}

          {revealed && result?.challenge && (
            <div className={`pop-in rounded-2xl p-3 text-center text-lg ${result.challenge.wonCard ? 'bg-amber-500/25 text-amber-100' : 'bg-white/5 text-violet-200'}`}>
              {result.challenge.wonCard
                ? `⚔️ ${game.players[result.challenge.player].name} צדק/ה ולקח/ה את השיר לציר שלו/ה!`
                : result.challenge.correct
                  ? `⚔️ ${game.players[result.challenge.player].name} צדק/ה גם, אבל השיר נשאר אצל ${player.name}. האסימון הלך.`
                  : `⚔️ האתגר של ${game.players[result.challenge.player].name} נכשל – האסימון הלך.`}
            </div>
          )}

          {/* ציר הזמן של השחקן שבתור */}
          {game.phase === 'listen' && (
            <div>
              <p className="text-center text-violet-200">{game.slot === null ? '👇 לחצו על + כדי למקם את השיר בציר' : 'אפשר לשנות מיקום'}</p>
              <Timeline timeline={player.timeline} selectable selectedSlot={game.slot} onSelect={(slot) => dispatch({ type: 'select', slot })} />
            </div>
          )}

          {game.phase === 'challenge' && (
            <div className="space-y-3 rounded-2xl bg-amber-500/10 p-3 ring-2 ring-amber-400/40">
              {!game.challenge ? (
                <>
                  <p className="text-center text-xl font-bold">⚔️ מישהו רוצה לאתגר את {player.name}?</p>
                  <p className="text-center text-sm text-amber-100/80">
                    עולה 🪙{CHALLENGE_COST}. אם {player.name} טעה/תה ואתם צדקתם – השיר עובר אליכם.
                  </p>
                  <Timeline timeline={player.timeline} lockedSlot={game.slot} lockedLabel={player.name} />
                  <div className="grid grid-cols-2 gap-2">
                    {eligibleChallengers(game).map((i) => (
                      <button key={i} onClick={() => dispatch({ type: 'challenger', player: i })} className="rounded-xl bg-amber-500 px-2 py-3 text-black">
                        <span className="block text-lg font-bold">⚔️ {game.players[i].name} מאתגר/ת</span>
                        <span className="block text-xs">יש לו/ה {game.players[i].tokens} אסימונים</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-center text-xl font-bold">
                    ⚔️ {game.players[game.challenge.player].name}, לחצו על + כדי לבחור מקום אחר בציר של {player.name}
                  </p>
                  <p className="text-center text-sm text-amber-100/80">גוללים הצידה כדי לראות את כל המקומות. האתגר עולה 🪙{CHALLENGE_COST}.</p>
                  <Timeline
                    timeline={player.timeline}
                    selectable
                    lockedSlot={game.slot}
                    lockedLabel={player.name}
                    selectedSlot={game.challenge.slot}
                    selectedMark="⚔️"
                    onSelect={(slot) => dispatch({ type: 'challengeSlot', slot })}
                  />
                  <button onClick={() => dispatch({ type: 'challenger', player: null })} className="w-full py-1 text-sm text-violet-300 underline">
                    ביטול האתגר
                  </button>
                </>
              )}
            </div>
          )}

          {revealed && (
            <Timeline timeline={player.timeline} highlightId={result?.correct ? game.song?.id : null} />
          )}
          {revealed && result?.challenge?.wonCard && (
            <div>
              <p className="text-center text-sm text-amber-200">הציר של {game.players[result.challenge.player].name}:</p>
              <Timeline timeline={game.players[result.challenge.player].timeline} highlightId={game.song?.id} compact />
            </div>
          )}

          {game.phase === 'listen' && (
            <>
              {game.settings.guessBonus && <p className="text-center text-sm text-violet-300">💡 אמרו בקול את שם השיר והאמן לפני החשיפה – ניחוש נכון = 🪙</p>}
              {exactOn && <YearGuess value={guess} onChange={setGuess} reward={game.settings.guessBonus ? '+🪙 אסימון' : 'כבוד 😎'} />}
              {eligibleChallengers(game).length > 0 ? (
                <button
                  onClick={() => dispatch({ type: 'lockIn' })}
                  disabled={game.slot === null || loading}
                  className="w-full rounded-2xl bg-violet-500 py-5 text-2xl font-black shadow-xl active:scale-95 disabled:opacity-40"
                >
                  ✓ סיימתי למקם
                </button>
              ) : (
                <button
                  onClick={reveal}
                  disabled={game.slot === null || loading}
                  className="w-full rounded-2xl bg-violet-500 py-5 text-2xl font-black shadow-xl active:scale-95 disabled:opacity-40"
                >
                  🃏 חשוף!
                </button>
              )}
              {game.settings.guessBonus && (player.tokens >= SKIP_COST || player.tokens >= BUY_COST) && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => withNewSong((song) => ({ type: 'skip', song }))}
                    disabled={loading || player.tokens < SKIP_COST}
                    className="rounded-xl bg-amber-500/20 py-3 text-amber-100 disabled:opacity-30"
                  >
                    ⏭ דילוג (🪙{SKIP_COST})
                  </button>
                  <button
                    onClick={() => dispatch({ type: 'buy' })}
                    disabled={loading || player.tokens < BUY_COST}
                    className="rounded-xl bg-amber-500/20 py-3 text-amber-100 disabled:opacity-30"
                  >
                    🛒 קניית השיר (🪙{BUY_COST})
                  </button>
                </div>
              )}
            </>
          )}

          {game.phase === 'challenge' && (
            <button
              onClick={reveal}
              disabled={!!game.challenge && game.challenge.slot === null}
              className="w-full rounded-2xl bg-violet-500 py-5 text-2xl font-black shadow-xl active:scale-95 disabled:opacity-40"
            >
              {!game.challenge ? '🃏 אין אתגר – חשוף!' : game.challenge.slot === null ? '👆 קודם בוחרים מקום (+)' : '🃏 חשוף!'}
            </button>
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
              {result.guessed === true && <p className="text-center text-amber-200">🪙 {player.name} קיבל/ה אסימון!</p>}

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

      {error && <ErrorBox error={error} />}
      {showScores && <Scoreboard game={game} onClose={() => setShowScores(false)} />}
    </main>
  )
}
