// שמירת מצב המשחק וההגדרות האחרונות ב-localStorage, כדי שרענון לא ימחק את המשחק.
import type { Settings } from './game'
import type { AnyGame } from './startGame'

const GAME_KEY = 'hitster.game.v1'
const SETTINGS_KEY = 'hitster.settings.v1'

export function saveGame(state: AnyGame | null) {
  try {
    if (state) localStorage.setItem(GAME_KEY, JSON.stringify(state))
    else localStorage.removeItem(GAME_KEY)
  } catch {
    /* ignore */
  }
}

export function loadGame(): AnyGame | null {
  try {
    const raw = localStorage.getItem(GAME_KEY)
    return raw ? (JSON.parse(raw) as AnyGame) : null
  } catch {
    return null
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

export function loadSettings(): Settings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? (JSON.parse(raw) as Settings) : null
  } catch {
    return null
  }
}
