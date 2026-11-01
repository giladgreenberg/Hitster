// התחברות לספוטיפיי ב-Authorization Code with PKCE (בלי client secret ובלי שרת)

const AUTH_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'

const TOKEN_KEY = 'hitster.token'
const VERIFIER_KEY = 'hitster.pkceVerifier'
const STATE_KEY = 'hitster.pkceState'
const CLIENT_ID_KEY = 'hitster.clientId'

// ההרשאות שנדרשות לכל האפליקציה (מבקשים הכול כבר עכשיו כדי לא להתחבר מחדש בהמשך)
export const SCOPES = [
  'streaming', // Web Playback SDK
  'user-read-email', // נדרש ע"י ה-SDK
  'user-read-private', // נדרש ע"י ה-SDK
  'user-read-playback-state', // רשימת מכשירים
  'user-modify-playback-state', // נגן / השהה במכשיר
  'playlist-read-private', // הפלייליסטים שלי
  'playlist-read-collaborative',
]

interface StoredToken {
  accessToken: string
  refreshToken: string
  expiresAt: number // ms since epoch
}

export function getClientId(): string {
  const fromEnv = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined
  if (fromEnv && fromEnv.trim()) return fromEnv.trim()
  return localStorage.getItem(CLIENT_ID_KEY) ?? ''
}

export function clientIdFromEnv(): boolean {
  return Boolean((import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined)?.trim())
}

export function setClientId(id: string) {
  localStorage.setItem(CLIENT_ID_KEY, id.trim())
}

export function getRedirectUri(): string {
  return `${window.location.origin}/callback`
}

function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const values = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(values, (v) => chars[v % chars.length]).join('')
}

async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

export async function startLogin() {
  const clientId = getClientId()
  if (!clientId) throw new Error('חסר Client ID')
  const verifier = randomString(64)
  const state = randomString(16)
  localStorage.setItem(VERIFIER_KEY, verifier)
  localStorage.setItem(STATE_KEY, state)
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: await sha256Base64Url(verifier),
    scope: SCOPES.join(' '),
    state,
  })
  window.location.assign(`${AUTH_URL}?${params}`)
}

function saveToken(json: { access_token: string; refresh_token?: string; expires_in: number }) {
  const prev = loadToken()
  const token: StoredToken = {
    accessToken: json.access_token,
    // ספוטיפיי לא תמיד מחזיר refresh_token חדש ברענון – אז שומרים את הקודם
    refreshToken: json.refresh_token ?? prev?.refreshToken ?? '',
    expiresAt: Date.now() + json.expires_in * 1000,
  }
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token))
}

function loadToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    return raw ? (JSON.parse(raw) as StoredToken) : null
  } catch {
    return null
  }
}

/** מטפל בחזרה מספוטיפיי לכתובת /callback. מחזיר הודעת שגיאה או null אם הצליח. */
export async function handleCallback(): Promise<string | null> {
  const params = new URLSearchParams(window.location.search)
  const error = params.get('error')
  if (error) return error === 'access_denied' ? 'ההתחברות בוטלה' : `שגיאה מספוטיפיי: ${error}`
  const code = params.get('code')
  const state = params.get('state')
  const verifier = localStorage.getItem(VERIFIER_KEY)
  if (!code || !verifier) return 'חסרים נתוני התחברות. נסו שוב.'
  if (state !== localStorage.getItem(STATE_KEY)) return 'אי-התאמה באבטחת ההתחברות (state). נסו שוב.'

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: getClientId(),
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
      code_verifier: verifier,
    }),
  })
  localStorage.removeItem(VERIFIER_KEY)
  localStorage.removeItem(STATE_KEY)
  if (!res.ok) {
    const body = await res.text()
    return `קבלת הטוקן נכשלה (${res.status}): ${body}`
  }
  saveToken(await res.json())
  return null
}

let refreshing: Promise<boolean> | null = null

async function refresh(): Promise<boolean> {
  const token = loadToken()
  if (!token?.refreshToken) return false
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: getClientId(),
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken,
    }),
  })
  if (!res.ok) return false
  saveToken(await res.json())
  return true
}

/** מחזיר access token תקף (מרענן אוטומטית אם פג). null = צריך להתחבר מחדש. */
export async function getAccessToken(forceRefresh = false): Promise<string | null> {
  const token = loadToken()
  if (!token) return null
  if (!forceRefresh && token.expiresAt - Date.now() > 60_000) return token.accessToken
  refreshing ??= refresh().finally(() => {
    refreshing = null
  })
  const ok = await refreshing
  return ok ? loadToken()!.accessToken : null
}

export function isLoggedIn(): boolean {
  return loadToken() !== null
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
}
