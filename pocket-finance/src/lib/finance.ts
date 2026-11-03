// פונקציות חישוב פיננסיות טהורות (ללא תלות ב-UI)

/** ממיר מחרוזת למספר. מתעלם מפסיקים של אלפים, רווחים ו-% ; תומך במינוס יוניקוד. */
export function parseNum(s: string | number): number {
  if (typeof s === 'number') return s
  const t = s.replace(/[−–]/g, '-').replace(/[,\s%₪$]/g, '')
  if (t === '' || t === '-' || t === '.') return NaN
  return Number(t)
}

/** רשימת מספרים מופרדת בפסיקים / נקודה-פסיק / רווחים */
export function parseList(s: string): number[] {
  const t = s.replace(/[−–]/g, '-')
  const parts = t.split(/[,;\n]+|\s+(?=[-+\d.])/).map((x) => x.trim()).filter(Boolean)
  return parts.map((x) => Number(x.replace(/\s/g, '')))
}

export function npv(rate: number, cfs: number[]): number {
  return cfs.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0)
}

export interface IrrResult {
  roots: number[]
  /** מספר החלפות הסימן בתזרים */
  signChanges: number
}

/**
 * IRR בשיטה נומרית: סורקים רשת שיעורים בין ‎-99%‎ ל-1000% ומחפשים החלפות סימן ב-NPV,
 * ואז מצמצמים כל קטע בבייסקשן. מחזיר את כל השורשים שנמצאו (יכולים להיות 0, 1 או כמה).
 */
export function irr(cfs: number[]): IrrResult {
  let signChanges = 0
  let prev = 0
  for (const cf of cfs) {
    if (cf === 0) continue
    const s = Math.sign(cf)
    if (prev !== 0 && s !== prev) signChanges++
    prev = s
  }
  const roots: number[] = []
  if (signChanges === 0) return { roots, signChanges }
  const f = (r: number) => npv(r, cfs)
  // רשת צפופה ליד 0 ודלילה יותר בשיעורים גבוהים
  const grid: number[] = []
  for (let r = -0.99; r < 1; r += 0.0025) grid.push(r)
  for (let r = 1; r <= 10; r += 0.02) grid.push(r)
  let a = grid[0]
  let fa = f(a)
  for (let i = 1; i < grid.length; i++) {
    const b = grid[i]
    const fb = f(b)
    if (fa === 0) {
      roots.push(a)
    } else if (Math.sign(fa) !== Math.sign(fb) && isFinite(fa) && isFinite(fb)) {
      roots.push(bisect(f, a, b))
    }
    a = b
    fa = fb
  }
  // הסרת כפילויות
  const uniq: number[] = []
  for (const r of roots) if (!uniq.some((u) => Math.abs(u - r) < 1e-6)) uniq.push(r)
  return { roots: uniq, signChanges }
}

export function bisect(f: (x: number) => number, lo: number, hi: number, tol = 1e-12, maxIter = 300): number {
  let flo = f(lo)
  for (let i = 0; i < maxIter; i++) {
    const mid = (lo + hi) / 2
    const fm = f(mid)
    if (fm === 0 || (hi - lo) / 2 < tol) return mid
    if (Math.sign(fm) === Math.sign(flo)) {
      lo = mid
      flo = fm
    } else hi = mid
  }
  return (lo + hi) / 2
}

/** MIRR: תזרימים שליליים מהוונים בשיעור המימון, חיוביים מוצברים בשיעור ההשקעה מחדש */
export function mirr(cfs: number[], financeRate: number, reinvestRate: number): { pvNeg: number; fvPos: number; n: number; value: number } {
  const n = cfs.length - 1
  let pvNeg = 0
  let fvPos = 0
  cfs.forEach((cf, t) => {
    if (cf < 0) pvNeg += cf / Math.pow(1 + financeRate, t)
    else fvPos += cf * Math.pow(1 + reinvestRate, n - t)
  })
  const value = Math.pow(fvPos / -pvNeg, 1 / n) - 1
  return { pvNeg, fvPos, n, value }
}

/** תקופת החזר (עם אינטרפולציה בתוך השנה). null אם ההשקעה לא מוחזרת */
export function payback(cfs: number[]): { years: number | null; cumulative: number[] } {
  const cumulative: number[] = []
  let cum = 0
  let years: number | null = null
  for (let t = 0; t < cfs.length; t++) {
    const before = cum
    cum += cfs[t]
    cumulative.push(cum)
    if (years === null && t > 0 && before < 0 && cum >= 0) {
      years = t - 1 + -before / cfs[t]
    }
  }
  return { years, cumulative }
}

export function discountedCfs(cfs: number[], rate: number): number[] {
  return cfs.map((cf, t) => cf / Math.pow(1 + rate, t))
}

export function annuityPvFactor(r: number, n: number): number {
  if (r === 0) return n
  return (1 - Math.pow(1 + r, -n)) / r
}

export function annuityFvFactor(r: number, n: number): number {
  if (r === 0) return n
  return (Math.pow(1 + r, n) - 1) / r
}

export interface Bond {
  face: number
  couponRate: number // שנתי, עשרוני
  years: number
  freq: number // תשלומים בשנה
}

export function bondPrice(b: Bond, ytm: number): number {
  const n = Math.round(b.years * b.freq)
  const c = (b.face * b.couponRate) / b.freq
  const y = ytm / b.freq
  return c * annuityPvFactor(y, n) + b.face / Math.pow(1 + y, n)
}

export function bondYtm(b: Bond, price: number): number | null {
  const f = (y: number) => bondPrice(b, y) - price
  const lo = -0.5 * b.freq + 1e-6
  const hi = 5
  if (Math.sign(f(lo)) === Math.sign(f(hi))) return null
  return bisect(f, Math.max(lo, -0.99), hi)
}

/** מח"מ מקולי בשנים */
export function macaulayDuration(b: Bond, ytm: number): number {
  const n = Math.round(b.years * b.freq)
  const c = (b.face * b.couponRate) / b.freq
  const y = ytm / b.freq
  let pv = 0
  let weighted = 0
  for (let k = 1; k <= n; k++) {
    const cf = k === n ? c + b.face : c
    const d = cf / Math.pow(1 + y, k)
    pv += d
    weighted += (k / b.freq) * d
  }
  return weighted / pv
}

// ---------- עיצוב מספרים ----------

export function fmt(x: number, digits = 2): string {
  if (!isFinite(x)) return '—'
  const v = Math.abs(x) < 0.5 * Math.pow(10, -digits) ? 0 : x
  return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits })
}

/** מספר עם מספר ספרות קבוע */
export function fmtFixed(x: number, digits = 2): string {
  if (!isFinite(x)) return '—'
  const v = Math.abs(x) < 0.5 * Math.pow(10, -digits) ? 0 : x
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** אחוז מתוך שבר עשרוני: 0.1234 → "12.34%" */
export function pct(x: number, digits = 2): string {
  return fmt(x * 100, digits) + '%'
}

/** מספר בתוך TeX (פסיק אלפים בלי רווח מיותר) */
export function tn(x: number, digits = 2): string {
  return fmt(x, digits).replace(/,/g, '{,}')
}

export function tp(x: number, digits = 2): string {
  return tn(x * 100, digits) + '\\%'
}
