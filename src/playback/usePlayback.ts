import { useCallback, useRef, useState } from 'react'
import { activateBrowserPlayer, getBrowserDeviceId } from './sdk'
import { isMobileBrowser, pause as apiPause, playTrack, randomStartMs, resume as apiResume } from './controller'
import type { Song } from '../songs/types'

export type OutputMode = { kind: 'browser' } | { kind: 'device'; id: string; name: string }

const KEY = 'hitster.output.v1'

function loadMode(): OutputMode | null {
  try {
    const m = JSON.parse(localStorage.getItem(KEY) ?? 'null') as OutputMode | null
    if (m?.kind === 'browser' && isMobileBrowser()) return null
    return m
  } catch {
    return null
  }
}

export function usePlayback() {
  const [mode, setModeState] = useState<OutputMode | null>(() => loadMode() ?? (isMobileBrowser() ? null : { kind: 'browser' }))
  const [isPlaying, setPlaying] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const current = useRef<{ uri: string; startMs: number } | null>(null)

  const setMode = useCallback((m: OutputMode | null) => {
    setModeState(m)
    if (m) localStorage.setItem(KEY, JSON.stringify(m))
    else localStorage.removeItem(KEY)
  }, [])

  const deviceId = useCallback(async () => {
    if (!mode) throw new Error('בחרו קודם על מה לנגן')
    if (mode.kind === 'browser') {
      activateBrowserPlayer()
      return getBrowserDeviceId()
    }
    return mode.id
  }, [mode])

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  /** מנגן שיר חדש. randomStart = להתחיל מנקודה אקראית */
  const playSong = useCallback(
    (song: Song, randomStart: boolean) =>
      run(async () => {
        const startMs = randomStart ? randomStartMs(song.durationMs) : 0
        current.current = { uri: song.uri, startMs }
        await playTrack(await deviceId(), song.uri, startMs)
        setPlaying(true)
      }),
    [deviceId, run],
  )

  /** נגן שוב מההתחלה (או מאותה נקודה אקראית שבה התחיל התור) */
  const restart = useCallback(
    () =>
      run(async () => {
        if (!current.current) return
        await playTrack(await deviceId(), current.current.uri, current.current.startMs)
        setPlaying(true)
      }),
    [deviceId, run],
  )

  const pause = useCallback(
    () =>
      run(async () => {
        await apiPause(await deviceId())
        setPlaying(false)
      }),
    [deviceId, run],
  )

  const resume = useCallback(
    () =>
      run(async () => {
        await apiResume(await deviceId())
        setPlaying(true)
      }),
    [deviceId, run],
  )

  /** עוצר בשקט (למשל במעבר לחשיפה) בלי להציג שגיאה */
  const stop = useCallback(async () => {
    setPlaying(false)
    try {
      if (mode) await apiPause(await deviceId())
    } catch {
      /* ignore */
    }
  }, [deviceId, mode])

  /** שיר חדש בתור: עוצרים את הקודם ושוכחים אותו */
  const reset = useCallback(() => {
    if (current.current) stop()
    current.current = null
    setPlaying(false)
  }, [stop])

  return { mode, setMode, reset, isPlaying, busy, error, playSong, restart, pause, resume, stop, hasSong: () => current.current !== null }
}

export type Playback = ReturnType<typeof usePlayback>
