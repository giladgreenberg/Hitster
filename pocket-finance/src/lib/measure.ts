// מתזמן מדידות: קודם כל הקריאות (layout) ואז כל הכתיבות, פעם אחת לכל פריים.
// כך עשרות כרטיסים לא גורמים ל-layout thrashing.
type Job = () => (() => void) | void

const queue = new Set<Job>()
let scheduled = false

function flush() {
  scheduled = false
  const jobs = [...queue]
  queue.clear()
  const writes = jobs.map((j) => j())
  for (const w of writes) if (w) w()
}

export function scheduleMeasure(job: Job) {
  queue.add(job)
  if (!scheduled) {
    scheduled = true
    requestAnimationFrame(flush)
  }
}

let fontsReady: Promise<unknown> | null = null
export function onFontsReady(cb: () => void) {
  fontsReady ??= document.fonts?.ready ?? Promise.resolve()
  fontsReady.then(cb).catch(() => {})
}
