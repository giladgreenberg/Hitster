// כפתורי סוף משחק: שיתוף כרטיס לסטורי + שמירת השירים לפלייליסט בספוטיפיי
import { useState } from 'react'
import { drawShareCard, shareCanvas, type ShareCardData } from '../share/shareCard'
import { createSummaryPlaylist, needsRelogin, playedUris, reloginAndCreateLater, summaryName } from '../spotify/playlists'
import { getBlacklist } from '../songs/blacklist'

export default function EndActions({ card, usedIds, onStats, statsLabel = '📊 סטטיסטיקות' }: { card: ShareCardData; usedIds: string[]; onStats: () => void; statsLabel?: string }) {
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [pl, setPl] = useState<{ state: 'idle' | 'busy' | 'done' | 'error' | 'relogin'; url?: string; msg?: string; count?: number }>({ state: 'idle' })

  const share = async () => {
    setSharing(true)
    setShareMsg(null)
    try {
      const canvas = await drawShareCard(card)
      const res = await shareCanvas(canvas, 'hitster.png', `${card.title} ${card.score} 🎵`)
      setShareMsg(res === 'downloaded' ? '📥 התמונה ירדה למכשיר – אפשר לשתף אותה מהגלריה' : res === 'shared' ? '✓ שותף!' : null)
    } catch (e) {
      setShareMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setSharing(false)
    }
  }

  const req = () => ({ name: summaryName(), uris: playedUris(usedIds, getBlacklist()) })

  const savePlaylist = async () => {
    if (needsRelogin()) {
      setPl({ state: 'relogin' })
      return
    }
    setPl({ state: 'busy' })
    try {
      const r = await createSummaryPlaylist(req())
      setPl({ state: 'done', url: r.url, count: r.count })
    } catch (e) {
      setPl({ state: 'error', msg: e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onStats} className="rounded-2xl bg-violet-500 py-3 text-lg font-bold active:scale-95">
          {statsLabel}
        </button>
        <button onClick={share} disabled={sharing} className="rounded-2xl bg-pink-500 py-3 text-lg font-bold active:scale-95 disabled:opacity-50">
          {sharing ? 'מכין תמונה…' : '📤 שתפו'}
        </button>
      </div>
      <div>
        <button
          onClick={savePlaylist}
          disabled={pl.state === 'busy' || pl.state === 'done'}
          className="w-full rounded-2xl bg-[#1db954] py-3 text-lg font-bold text-black active:scale-95 disabled:opacity-60"
        >
          {pl.state === 'busy' ? 'שומר…' : pl.state === 'done' ? '✓ נשמר' : '🎵 שמרו לפלייליסט'}
        </button>
      </div>
      {shareMsg && <p className="text-center text-sm text-violet-200">{shareMsg}</p>}

      {pl.state === 'done' && (
        <a href={pl.url} target="_blank" rel="noreferrer" className="block rounded-2xl bg-[#1db954]/20 p-3 text-center text-green-200">
          ✓ הפלייליסט "{summaryName()}" נשמר עם {pl.count} שירים – <u>פתיחה בספוטיפיי</u>
        </a>
      )}
      {pl.state === 'relogin' && (
        <div className="space-y-2 rounded-2xl bg-amber-500/15 p-3 text-center text-amber-100">
          <p className="text-sm">כדי לשמור פלייליסט צריך לאשר לספוטיפיי הרשאה חדשה. מתחברים מחדש פעם אחת, והפלייליסט יישמר אוטומטית כשחוזרים.</p>
          <button onClick={() => reloginAndCreateLater(req())} className="w-full rounded-xl bg-amber-400 py-3 font-bold text-black">
            התחברות מחדש ושמירה
          </button>
        </div>
      )}
      {pl.state === 'error' && <p className="rounded-xl bg-red-500/20 p-3 text-sm text-red-200">{pl.msg}</p>}
    </div>
  )
}
