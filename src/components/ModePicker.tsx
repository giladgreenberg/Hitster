import { MODES, type GameMode } from '../game/modes'

export default function ModePicker({ value, onChange, disabled = [] }: { value: GameMode; onChange: (m: GameMode) => void; disabled?: GameMode[] }) {
  return (
    <div className="space-y-2">
      {MODES.map((m) => {
        const on = value === m.id
        const off = disabled.includes(m.id)
        return (
          <button
            key={m.id}
            disabled={off}
            onClick={() => onChange(m.id)}
            className={`flex w-full items-start gap-3 rounded-2xl p-3 text-start transition ${on ? 'bg-green-500 text-black ring-2 ring-green-300' : 'bg-white/10'} disabled:opacity-40`}
          >
            <span className="text-3xl leading-none">{m.emoji}</span>
            <span className="flex-1">
              <span className="block text-lg font-bold">
                {m.title}
                {off && <span className="ms-2 text-xs font-normal">(בקרוב)</span>}
              </span>
              <span className={`block text-sm leading-snug ${on ? 'text-black/80' : 'text-violet-300'}`}>{m.desc}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
