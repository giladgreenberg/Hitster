// בחירה על מה לנגן: הדפדפן (מחשב) או מכשיר Spotify Connect (אפליקציית ספוטיפיי בטלפון, רמקול…)
import { useEffect, useState } from 'react'
import { getDevices, isMobileBrowser, type Device } from '../playback/controller'
import type { Playback } from '../playback/usePlayback'

const ICONS: Record<string, string> = { Computer: '💻', Smartphone: '📱', Speaker: '🔊', TV: '📺', Tablet: '📱' }

export default function OutputPicker({ playback }: { playback: Playback }) {
  const mobile = isMobileBrowser()
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mode, setMode } = playback

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      // את הנגן של הדפדפן הזה לא מציגים ברשימה – יש לו כפתור משלו
      setDevices((await getDevices()).filter((d) => !d.name.startsWith('היטסטר')))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const btn = (active: boolean) =>
    `flex w-full items-center gap-3 rounded-xl p-3 text-start text-lg ${active ? 'bg-green-500 font-bold text-black' : 'bg-white/10'}`

  return (
    <div className="space-y-3">
      {!mobile && (
        <button className={btn(mode?.kind === 'browser')} onClick={() => setMode({ kind: 'browser' })}>
          <span>🖥️</span> נגן כאן בדפדפן
          {mode?.kind === 'browser' && <span className="ms-auto text-sm">{playback.browserReady ? '✓ מוכן' : 'טוען…'}</span>}
        </button>
      )}

      {mobile && (
        <p className="rounded-xl bg-white/5 p-3 text-sm text-violet-200">
          בטלפון אי אפשר לנגן ישירות בדפדפן. פתחו את אפליקציית ספוטיפיי (מספיק להפעיל ולעצור שיר כלשהו), חזרו לכאן ולחצו "רענון".
        </p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm text-violet-300">מכשירים זמינים בחשבון</span>
        <div className="flex gap-2">
          {mobile && (
            <a href="spotify:" className="rounded-lg bg-white/10 px-3 py-1 text-sm">
              פתח ספוטיפיי
            </a>
          )}
          <button onClick={refresh} disabled={loading} className="rounded-lg bg-white/10 px-3 py-1 text-sm">
            {loading ? '…' : 'רענון'}
          </button>
        </div>
      </div>

      {devices?.length === 0 && <p className="text-sm text-violet-300">לא נמצאו מכשירים. ודאו שאפליקציית ספוטיפיי פתוחה ומחוברת לאותו חשבון.</p>}
      {devices?.map((d) => (
        <button key={d.id} className={btn(mode?.kind === 'device' && mode.id === d.id)} onClick={() => setMode({ kind: 'device', id: d.id, name: d.name })}>
          <span>{ICONS[d.type] ?? '🎧'}</span>
          {d.name}
        </button>
      ))}
      {error && <p className="text-sm text-red-300">{error}</p>}

      {mode?.kind === 'device' && (
        <p className="rounded-xl bg-amber-500/20 p-3 text-amber-100">
          ⚠️ אפליקציית ספוטיפיי מציגה את שם השיר. הניחו את הטלפון עם המסך כלפי מטה, או השתמשו ברמקול.
        </p>
      )}
    </div>
  )
}
