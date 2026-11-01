// מוזיקת ניצחון קצרה ומקורית – נוצרת בקוד עם Web Audio (בלי קובץ ובלי זכויות יוצרים).
// ארפג'ו עולה, ואז אקורד מז'ור מסיים עם "ברק" קטן למעלה.

let ctx: AudioContext | null = null

function note(ac: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, gain: number) {
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  g.gain.setValueAtTime(0, start)
  g.gain.linearRampToValueAtTime(gain, start + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(g).connect(ac.destination)
  osc.start(start)
  osc.stop(start + dur + 0.05)
}

export function playFanfare() {
  try {
    ctx ??= new AudioContext()
    const ac = ctx
    if (ac.state === 'suspended') void ac.resume()
    const t = ac.currentTime + 0.05
    // סול – דו – מי – סול (עולה), ואז אקורד דו מז'ור ארוך
    const run = [392.0, 523.25, 659.25, 783.99]
    run.forEach((f, i) => note(ac, f, t + i * 0.12, 0.22, 'triangle', 0.22))
    const chordAt = t + run.length * 0.12 + 0.05
    for (const f of [523.25, 659.25, 783.99, 1046.5]) note(ac, f, chordAt, 1.1, 'triangle', 0.14)
    note(ac, 261.63, chordAt, 1.2, 'sine', 0.2) // בס
    note(ac, 2093.0, chordAt + 0.15, 0.5, 'sine', 0.05) // ברק
  } catch {
    /* דפדפן בלי Web Audio – בלי צליל */
  }
}
