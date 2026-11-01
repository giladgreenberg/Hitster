// מסך הסטטיסטיקות שאחרי הפודיום
import type { GameEvent } from '../game/events'
import { accuracy, biggestMiss, highlight, strongestDecades } from '../game/stats'

const decadeName = (d: number) => (d >= 2000 ? `שנות ה-${d}` : `שנות ה-${d % 100}`)

function Card({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="pop-in rounded-2xl bg-white/5 p-4 text-start">
      <div className="mb-1 text-sm font-bold text-violet-300">
        {icon} {title}
      </div>
      <div className="text-lg leading-snug">{children}</div>
    </div>
  )
}

export default function StatsPanel({ events, actors }: { events: GameEvent[]; actors: string[] }) {
  const decades = strongestDecades(events)
  const miss = biggestMiss(events)
  const best = highlight(events)
  const acc = accuracy(events)

  if (events.length === 0) return <p className="text-center text-violet-300">לא נאספו מספיק נתונים למשחק הזה</p>

  return (
    <div className="space-y-3">
      {best && (
        <Card icon="⭐" title="רגע השיא">
          {best.type === 'exact' && (
            <>
              <b>{best.actor}</b> קלע/ה בול לשנה <b>{best.year}</b> עם <bdi>"{best.songName}"</bdi>!
            </>
          )}
          {best.type === 'streak' && (
            <>
              <b>{best.actor}</b> מיקמ/ה נכון <b>{best.length}</b> שירים ברצף!
            </>
          )}
          {best.type === 'dense' && (
            <>
              <b>{best.actor}</b> מיקמ/ה נכון את <bdi>"{best.songName}"</bdi> בציר של <b>{best.size}</b> שירים!
            </>
          )}
        </Card>
      )}

      {miss && (
        <Card icon="😱" title="הטעות הכי גדולה">
          <b>{miss.actor}</b> טעה/תה ב-<b>{miss.distance}</b> שנים עם <bdi>"{miss.songName}"</bdi> ({miss.year})!
        </Card>
      )}

      <Card icon="📅" title="העשור החזק">
        <ul className="space-y-1">
          {actors.map((a) => {
            const d = decades.get(a)
            return (
              <li key={a} className="flex justify-between gap-2">
                <b className="truncate">{a}</b>
                <span className="text-base">{d ? `${decadeName(d.decade)} · ${d.correct}/${d.total} (${Math.round(d.rate * 100)}%)` : 'לא מספיק שירים'}</span>
              </li>
            )
          })}
        </ul>
      </Card>

      <Card icon="🎯" title="אחוז הצלחה">
        <ul className="space-y-1">
          {actors.map((a) => {
            const x = acc.get(a)
            return (
              <li key={a} className="flex justify-between gap-2">
                <b className="truncate">{a}</b>
                <span className="text-base">{x ? `${x.correct}/${x.total} (${Math.round((x.correct / x.total) * 100)}%)` : '—'}</span>
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}
