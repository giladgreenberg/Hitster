// מחשבונים לכל נוסחה. ערכי ברירת המחדל מגיעים מהדוגמה שבקובץ הנתונים (formulas.ts)
import type { Tone } from '../data/types'
import {
  annuityFvFactor,
  annuityPvFactor,
  bondPrice,
  bondYtm,
  discountedCfs,
  fmt,
  fmtFixed,
  irr,
  macaulayDuration,
  mirr,
  npv,
  parseList,
  parseNum,
  payback,
  pct,
  tn,
  tp,
} from './finance'

export type InputKind = 'num' | 'pct' | 'list' | 'int'

export interface CalcInput {
  key: string
  label: string
  kind: InputKind
  /** מאפשר ערכים שליליים (משפיע על סוג המקלדת) */
  signed?: boolean
  hint?: string
}

export interface CalcResult {
  /** למשל "NPV" */
  label: string
  /** ערך מספרי (לבדיקות). null אם אין תוצאה */
  value: number | null
  /** הטקסט שמוצג בכרטיס התוצאה */
  text: string
  extras?: string[]
  badge?: { tone: Tone; text: string }
  /** שלבי פתרון. קטעים בין $...$ מוצגים כ-TeX */
  steps: string[]
  error?: string
}

type Vals = Record<string, number & number[]> & Record<string, any>

export interface Calculator {
  inputs: CalcInput[]
  compute: (v: Vals) => CalcResult
}

function err(label: string, error: string): CalcResult {
  return { label, value: null, text: '—', steps: [], error }
}

/** דירוג לפי טווחים: מחזיר טון לפי הפונקציות שהתקיימו */
function grade(v: number, good: (v: number) => boolean, ok: (v: number) => boolean): Tone {
  return good(v) ? 'good' : ok(v) ? 'ok' : 'bad'
}

const toneWord: Record<Tone, string> = { good: 'טוב', ok: 'סביר', bad: 'בעייתי', info: '' }

function ratioBadge(tone: Tone, texts: Partial<Record<Tone, string>>) {
  const icon = tone === 'good' ? '✓' : tone === 'ok' ? '•' : '!'
  return { tone, text: `${icon} ${toneWord[tone]} – ${texts[tone] ?? ''}`.trim() }
}

const num = (key: string, label: string, signed = false, hint?: string): CalcInput => ({ key, label, kind: 'num', signed, hint })
const per = (key: string, label: string, signed = false, hint?: string): CalcInput => ({ key, label, kind: 'pct', signed, hint })
const int = (key: string, label: string, hint?: string): CalcInput => ({ key, label, kind: 'int', hint })
const list = (key: string, label: string, hint?: string): CalcInput => ({ key, label, kind: 'list', signed: true, hint })

const CF_LIST = list('cfs', 'תזרימים לפי שנים (מופרדים בפסיק)', 'שנה 0 קודם, ההשקעה במינוס: -1000, 300, 400')

function checkCfs(cfs: number[], label: string): CalcResult | null {
  if (cfs.length < 2 || cfs.some((x) => !isFinite(x))) return err(label, 'יש להזין לפחות שני תזרימים מספריים, מופרדים בפסיק')
  return null
}

function discountTermsTex(cfs: number[], r: number) {
  return cfs
    .slice(1)
    .map((cf, i) => `\\frac{${tn(cf)}}{(1+${tn(r, 4)})^{${i + 1}}}`)
    .join(' + ')
}

// ------------------------------------------------------------------

export const calculators: Record<string, Calculator> = {
  // ===== היוון וערך הזמן של הכסף =====
  fv: {
    inputs: [num('pv', 'ערך נוכחי (PV)'), per('r', 'ריבית לתקופה'), int('n', 'מספר תקופות (n)')],
    compute: ({ pv, r, n }) => {
      const f = Math.pow(1 + r, n)
      const v = pv * f
      return {
        label: 'FV',
        value: v,
        text: fmtFixed(v),
        steps: [
          `מקדם הצבירה: $(1+${tn(r, 4)})^{${n}} = ${tn(f, 4)}$`,
          `$FV = ${tn(pv)} \\times ${tn(f, 4)} = ${tn(v)}$`,
          `הריבית שנצברה: $${tn(v - pv)}$`,
        ],
      }
    },
  },
  pv: {
    inputs: [num('fv', 'ערך עתידי (FV)'), per('r', 'שיעור היוון לתקופה'), int('n', 'מספר תקופות (n)')],
    compute: ({ fv, r, n }) => {
      const f = Math.pow(1 + r, n)
      const v = fv / f
      return {
        label: 'PV',
        value: v,
        text: fmtFixed(v),
        steps: [`$(1+${tn(r, 4)})^{${n}} = ${tn(f, 4)}$`, `$PV = \\frac{${tn(fv)}}{${tn(f, 4)}} = ${tn(v)}$`],
      }
    },
  },
  pv_annuity: {
    inputs: [num('pmt', 'תשלום קבוע (PMT)'), per('r', 'ריבית לתקופה'), int('n', 'מספר תשלומים (n)')],
    compute: ({ pmt, r, n }) => {
      const f = annuityPvFactor(r, n)
      const v = pmt * f
      return {
        label: 'PV',
        value: v,
        text: fmtFixed(v),
        steps: [
          `$(1+${tn(r, 4)})^{-${n}} = ${tn(Math.pow(1 + r, -n), 4)}$`,
          `מקדם היוון אנונה: $\\frac{1-${tn(Math.pow(1 + r, -n), 4)}}{${tn(r, 4)}} = ${tn(f, 4)}$`,
          `$PV = ${tn(pmt)} \\times ${tn(f, 4)} = ${tn(v)}$`,
        ],
      }
    },
  },
  fv_annuity: {
    inputs: [num('pmt', 'תשלום קבוע (PMT)'), per('r', 'ריבית לתקופה'), int('n', 'מספר תשלומים (n)')],
    compute: ({ pmt, r, n }) => {
      const f = annuityFvFactor(r, n)
      const v = pmt * f
      return {
        label: 'FV',
        value: v,
        text: fmtFixed(v),
        steps: [
          `$(1+${tn(r, 4)})^{${n}} = ${tn(Math.pow(1 + r, n), 4)}$`,
          `מקדם צבירה: $\\frac{${tn(Math.pow(1 + r, n), 4)}-1}{${tn(r, 4)}} = ${tn(f, 4)}$`,
          `$FV = ${tn(pmt)} \\times ${tn(f, 4)} = ${tn(v)}$`,
        ],
      }
    },
  },
  pv_annuity_due: {
    inputs: [num('pmt', 'תשלום קבוע (PMT)'), per('r', 'ריבית לתקופה'), int('n', 'מספר תשלומים (n)')],
    compute: ({ pmt, r, n }) => {
      const ord = pmt * annuityPvFactor(r, n)
      const v = ord * (1 + r)
      return {
        label: 'PV',
        value: v,
        text: fmtFixed(v),
        extras: [`אנונה רגילה: ${fmtFixed(ord)}`],
        steps: [
          `ערך נוכחי של אנונה רגילה: $${tn(pmt)} \\times ${tn(annuityPvFactor(r, n), 4)} = ${tn(ord)}$`,
          `התשלומים מוקדמים בתקופה אחת, לכן מכפילים ב-$(1+r)$: $${tn(ord)} \\times ${tn(1 + r, 4)} = ${tn(v)}$`,
        ],
      }
    },
  },
  fv_annuity_due: {
    inputs: [num('pmt', 'תשלום קבוע (PMT)'), per('r', 'ריבית לתקופה'), int('n', 'מספר תשלומים (n)')],
    compute: ({ pmt, r, n }) => {
      const ord = pmt * annuityFvFactor(r, n)
      const v = ord * (1 + r)
      return {
        label: 'FV',
        value: v,
        text: fmtFixed(v),
        extras: [`אנונה רגילה: ${fmtFixed(ord)}`],
        steps: [
          `ערך עתידי של אנונה רגילה: $${tn(pmt)} \\times ${tn(annuityFvFactor(r, n), 4)} = ${tn(ord)}$`,
          `כל תשלום צובר תקופה נוספת: $${tn(ord)} \\times ${tn(1 + r, 4)} = ${tn(v)}$`,
        ],
      }
    },
  },
  perpetuity: {
    inputs: [num('c', 'תשלום קבוע לתקופה (C)'), per('r', 'שיעור היוון')],
    compute: ({ c, r }) => {
      if (r <= 0) return err('PV', 'שיעור ההיוון חייב להיות חיובי')
      const v = c / r
      return { label: 'PV', value: v, text: fmtFixed(v), steps: [`$PV = \\frac{${tn(c)}}{${tn(r, 4)}} = ${tn(v)}$`] }
    },
  },
  growing_perpetuity: {
    inputs: [num('c1', 'תשלום בעוד שנה (C₁)'), per('r', 'שיעור היוון'), per('g', 'שיעור צמיחה', true)],
    compute: ({ c1, r, g }) => {
      if (r <= g) return err('PV', 'הנוסחה תקפה רק כש-r גדול מ-g')
      const v = c1 / (r - g)
      return {
        label: 'PV',
        value: v,
        text: fmtFixed(v),
        steps: [`$r-g = ${tn(r, 4)} - ${tn(g, 4)} = ${tn(r - g, 4)}$`, `$PV = \\frac{${tn(c1)}}{${tn(r - g, 4)}} = ${tn(v)}$`],
      }
    },
  },
  growing_annuity: {
    inputs: [num('c1', 'תשלום ראשון (C₁)'), per('r', 'שיעור היוון'), per('g', 'שיעור צמיחה', true), int('n', 'מספר תשלומים (n)')],
    compute: ({ c1, r, g, n }) => {
      if (Math.abs(r - g) < 1e-12) {
        const v = (c1 * n) / (1 + r)
        return { label: 'PV', value: v, text: fmtFixed(v), steps: [`כש-$r=g$: $PV = \\frac{n\\,C_1}{1+r} = ${tn(v)}$`] }
      }
      const ratio = Math.pow((1 + g) / (1 + r), n)
      const v = (c1 / (r - g)) * (1 - ratio)
      return {
        label: 'PV',
        value: v,
        text: fmtFixed(v),
        steps: [
          `$\\left(\\frac{1+g}{1+r}\\right)^n = \\left(\\frac{${tn(1 + g, 4)}}{${tn(1 + r, 4)}}\\right)^{${n}} = ${tn(ratio, 4)}$`,
          `$\\frac{C_1}{r-g} = \\frac{${tn(c1)}}{${tn(r - g, 4)}} = ${tn(c1 / (r - g))}$`,
          `$PV = ${tn(c1 / (r - g))} \\times (1-${tn(ratio, 4)}) = ${tn(v)}$`,
        ],
      }
    },
  },
  continuous: {
    inputs: [num('pv', 'ערך נוכחי (PV)'), per('r', 'ריבית שנתית רציפה'), num('t', 'זמן בשנים (t)')],
    compute: ({ pv, r, t }) => {
      const f = Math.exp(r * t)
      const v = pv * f
      return {
        label: 'FV',
        value: v,
        text: fmtFixed(v),
        extras: [`ריבית אפקטיבית שנתית: ${pct(Math.exp(r) - 1)}`],
        steps: [`$r \\cdot t = ${tn(r, 4)} \\times ${tn(t)} = ${tn(r * t, 4)}$`, `$e^{${tn(r * t, 4)}} = ${tn(f, 4)}$`, `$FV = ${tn(pv)} \\times ${tn(f, 4)} = ${tn(v)}$`],
      }
    },
  },
  rule72: {
    inputs: [per('r', 'ריבית שנתית')],
    compute: ({ r }) => {
      if (r <= 0) return err('שנים', 'הריבית חייבת להיות חיובית')
      const v = 72 / (r * 100)
      const exact = Math.log(2) / Math.log(1 + r)
      return {
        label: 'הכפלה בעוד',
        value: v,
        text: `${fmt(v, 2)} שנים`,
        extras: [`חישוב מדויק: ${fmt(exact, 2)} שנים`],
        steps: [`$\\frac{72}{${tn(r * 100)}} = ${tn(v)}$ שנים`, `בדיקה מדויקת: $\\frac{\\ln 2}{\\ln(${tn(1 + r, 4)})} = ${tn(exact)}$`],
      }
    },
  },

  // ===== ריביות =====
  simple_interest: {
    inputs: [num('p', 'קרן (P)'), per('r', 'ריבית שנתית'), num('t', 'שנים (t)')],
    compute: ({ p, r, t }) => {
      const i = p * r * t
      const v = p + i
      const comp = p * Math.pow(1 + r, t)
      return {
        label: 'FV (פשוטה)',
        value: v,
        text: fmtFixed(v),
        extras: [`בריבית דריבית: ${fmtFixed(comp)} (הפרש ${fmtFixed(comp - v)})`],
        steps: [
          `ריבית: $I = ${tn(p)} \\times ${tn(r, 4)} \\times ${tn(t)} = ${tn(i)}$`,
          `$FV = ${tn(p)} + ${tn(i)} = ${tn(v)}$`,
          `להשוואה, דריבית: $${tn(p)}(1+${tn(r, 4)})^{${tn(t)}} = ${tn(comp)}$`,
        ],
      }
    },
  },
  compound_interest: {
    inputs: [num('p', 'קרן (P)'), per('r', 'ריבית שנתית נקובה'), int('m', 'מספר צבירות בשנה (m)'), num('t', 'שנים (t)')],
    compute: ({ p, r, m, t }) => {
      const per = r / m
      const f = Math.pow(1 + per, m * t)
      const v = p * f
      return {
        label: 'FV',
        value: v,
        text: fmtFixed(v),
        steps: [`ריבית לתקופה: $\\frac{${tn(r, 4)}}{${m}} = ${tn(per, 6)}$`, `מספר תקופות: $${m} \\times ${tn(t)} = ${tn(m * t)}$`, `$FV = ${tn(p)} \\times (1+${tn(per, 6)})^{${tn(m * t)}} = ${tn(v)}$`],
      }
    },
  },
  ear: {
    inputs: [per('apr', 'ריבית שנתית נקובה (APR)'), int('m', 'מספר צבירות בשנה (m)')],
    compute: ({ apr, m }) => {
      const v = Math.pow(1 + apr / m, m) - 1
      return {
        label: 'EAR',
        value: v * 100,
        text: pct(v, 4),
        steps: [`$\\frac{APR}{m} = \\frac{${tn(apr, 4)}}{${m}} = ${tn(apr / m, 6)}$`, `$EAR = (1+${tn(apr / m, 6)})^{${m}} - 1 = ${tp(v, 4)}$`],
      }
    },
  },
  apr: {
    inputs: [per('ear', 'ריבית אפקטיבית שנתית (EAR)'), int('m', 'מספר צבירות בשנה (m)')],
    compute: ({ ear, m }) => {
      const per = Math.pow(1 + ear, 1 / m) - 1
      const v = m * per
      return {
        label: 'APR',
        value: v * 100,
        text: pct(v, 4),
        steps: [`ריבית לתקופה: $(1+${tn(ear, 4)})^{1/${m}} - 1 = ${tn(per, 6)}$`, `$APR = ${m} \\times ${tn(per, 6)} = ${tp(v, 4)}$`],
      }
    },
  },
  rate_conversion: {
    inputs: [per('r1', 'ריבית אפקטיבית לתקופה הנתונה'), num('n1', 'תקופות בשנה – נתון'), num('n2', 'תקופות בשנה – מבוקש')],
    compute: ({ r1, n1, n2 }) => {
      const k = n1 / n2
      const v = Math.pow(1 + r1, k) - 1
      return {
        label: 'ריבית לתקופה החדשה',
        value: v * 100,
        text: pct(v, 4),
        extras: [`שנתית אפקטיבית: ${pct(Math.pow(1 + r1, n1) - 1, 4)}`],
        steps: [`יחס התקופות: $\\frac{${tn(n1)}}{${tn(n2)}} = ${tn(k, 4)}$`, `$r_2 = (1+${tn(r1, 6)})^{${tn(k, 4)}} - 1 = ${tp(v, 4)}$`],
      }
    },
  },
  fisher: {
    inputs: [per('i', 'ריבית נומינלית'), per('pi', 'שיעור אינפלציה', true)],
    compute: ({ i, pi }) => {
      const v = (1 + i) / (1 + pi) - 1
      return {
        label: 'ריבית ריאלית',
        value: v * 100,
        text: pct(v, 4),
        extras: [`קירוב (i − π): ${pct(i - pi)}`],
        steps: [`$r = \\frac{1+${tn(i, 4)}}{1+${tn(pi, 4)}} - 1 = \\frac{${tn(1 + i, 4)}}{${tn(1 + pi, 4)}} - 1 = ${tp(v, 4)}$`],
      }
    },
  },
  spitzer: {
    inputs: [num('p', 'סכום ההלוואה'), per('r', 'ריבית שנתית'), num('years', 'תקופה בשנים')],
    compute: ({ p, r, years }) => {
      const i = r / 12
      const n = Math.round(years * 12)
      const v = i === 0 ? p / n : (p * i) / (1 - Math.pow(1 + i, -n))
      const total = v * n
      return {
        label: 'תשלום חודשי',
        value: v,
        text: fmtFixed(v),
        extras: [`סה"כ תשלומים: ${fmtFixed(total)}`, `סה"כ ריבית: ${fmtFixed(total - p)}`],
        steps: [
          `ריבית חודשית: $\\frac{${tn(r, 4)}}{12} = ${tn(i, 6)}$, מספר תשלומים: $${n}$`,
          `$(1+${tn(i, 6)})^{-${n}} = ${tn(Math.pow(1 + i, -n), 6)}$`,
          `$PMT = \\frac{${tn(p)} \\times ${tn(i, 6)}}{1-${tn(Math.pow(1 + i, -n), 6)}} = ${tn(v)}$`,
          `בתשלום הראשון: ריבית $${tn(p * i)}$, קרן $${tn(v - p * i)}$`,
        ],
      }
    },
  },

  // ===== תקציב הון =====
  npv: {
    inputs: [per('r', 'שיעור היוון'), CF_LIST],
    compute: ({ r, cfs }) => {
      const bad = checkCfs(cfs, 'NPV')
      if (bad) return bad
      const v = npv(r, cfs)
      const ir = irr(cfs)
      const extras = ir.roots.length === 1 ? [`IRR ≈ ${pct(ir.roots[0], 1)}`] : ir.roots.length > 1 ? [`כמה IRR: ${ir.roots.map((x) => pct(x, 1)).join(', ')}`] : []
      const disc = discountedCfs(cfs, r)
      return {
        label: 'NPV',
        value: v,
        text: fmtFixed(v),
        extras,
        badge:
          v > 0
            ? { tone: 'good', text: '✓ NPV > 0 ← כדאי לקבל את הפרויקט' }
            : v < 0
              ? { tone: 'bad', text: '✗ NPV < 0 ← לדחות את הפרויקט' }
              : { tone: 'ok', text: 'NPV = 0 ← אדישות' },
        steps: [
          `$NPV = ${tn(cfs[0])} + ${discountTermsTex(cfs, r)}$`,
          ...disc.slice(1).map((d, t) => `שנה ${t + 1}: $\\frac{${tn(cfs[t + 1])}}{${tn(Math.pow(1 + r, t + 1), 4)}} = ${tn(d)}$`),
          `סכום הערכים הנוכחיים: $${tn(disc.slice(1).reduce((a, b) => a + b, 0))}$`,
          `$NPV = ${tn(disc.slice(1).reduce((a, b) => a + b, 0))} ${cfs[0] < 0 ? '-' : '+'} ${tn(Math.abs(cfs[0]))} = ${tn(v)}$`,
        ],
      }
    },
  },
  irr: {
    inputs: [CF_LIST, per('k', 'עלות ההון (לצורך החלטה)')],
    compute: ({ cfs, k }) => {
      const bad = checkCfs(cfs, 'IRR')
      if (bad) return bad
      const res = irr(cfs)
      const npvK = npv(k, cfs)
      if (res.roots.length === 0) {
        return {
          label: 'IRR',
          value: null,
          text: 'אין פתרון',
          error: res.signChanges === 0 ? 'אין החלפת סימן בתזרים, ולכן אין IRR. בדקו שההשקעה בשנה 0 מוזנת במינוס.' : 'לא נמצא שיעור שבו NPV = 0 בטווח ‎-99%‎ עד 1000%.',
          extras: [`NPV בעלות ההון: ${fmtFixed(npvK)}`],
          steps: [],
        }
      }
      const steps = [
        `מחפשים $r$ שעבורו $NPV(r) = 0$. אין נוסחה סגורה, לכן משתמשים בחיפוש נומרי (בייסקשן).`,
        `בעלות ההון: $NPV(${tp(k)}) = ${tn(npvK)}$`,
      ]
      res.roots.forEach((x) => {
        steps.push(`נמצא שורש: $NPV(${tp(x, 4)}) \\approx 0$`)
        steps.push(`בדיקה: $NPV(${tp(x - 0.01, 2)}) = ${tn(npv(x - 0.01, cfs))}$, $NPV(${tp(x + 0.01, 2)}) = ${tn(npv(x + 0.01, cfs))}$`)
      })
      if (res.roots.length > 1) {
        return {
          label: 'IRR',
          value: res.roots[0] * 100,
          text: res.roots.map((x) => pct(x, 2)).join(' / '),
          badge: { tone: 'ok', text: `! ${res.roots.length} פתרונות (התזרים מחליף סימן ${res.signChanges} פעמים). החליטו לפי NPV או MIRR` },
          extras: [`NPV בעלות ההון: ${fmtFixed(npvK)}`],
          steps,
        }
      }
      const v = res.roots[0]
      steps.push(`משווים לעלות ההון: $${tp(v)} ${v > k ? '>' : v < k ? '<' : '='} ${tp(k)}$`)
      return {
        label: 'IRR',
        value: v * 100,
        text: pct(v, 2),
        extras: [`NPV בעלות ההון: ${fmtFixed(npvK)}`],
        badge: v > k ? { tone: 'good', text: `✓ IRR > ${pct(k, 1)} ← כדאי לקבל` } : v < k ? { tone: 'bad', text: `✗ IRR < ${pct(k, 1)} ← לדחות` } : { tone: 'ok', text: 'IRR = עלות ההון ← אדישות' },
        steps,
      }
    },
  },
  mirr: {
    inputs: [CF_LIST, per('fr', 'שיעור מימון (היוון שליליים)'), per('rr', 'שיעור השקעה מחדש')],
    compute: ({ cfs, fr, rr }) => {
      const bad = checkCfs(cfs, 'MIRR')
      if (bad) return bad
      if (!cfs.some((x: number) => x < 0) || !cfs.some((x: number) => x > 0)) return err('MIRR', 'צריך לפחות תזרים שלילי אחד וחיובי אחד')
      const m = mirr(cfs, fr, rr)
      return {
        label: 'MIRR',
        value: m.value * 100,
        text: pct(m.value, 2),
        badge: m.value > fr ? { tone: 'good', text: `✓ MIRR > ${pct(fr, 1)} ← כדאי לקבל` } : { tone: 'bad', text: `✗ MIRR < ${pct(fr, 1)} ← לדחות` },
        steps: [
          `ערך נוכחי של התזרימים השליליים: $PV^- = ${tn(m.pvNeg)}$`,
          `ערך עתידי (בשנה ${m.n}) של החיוביים בשיעור $${tp(rr)}$: $FV^+ = ${tn(m.fvPos)}$`,
          `$MIRR = \\left(\\frac{${tn(m.fvPos)}}{${tn(-m.pvNeg)}}\\right)^{1/${m.n}} - 1 = ${tp(m.value)}$`,
        ],
      }
    },
  },
  pi: {
    inputs: [per('r', 'שיעור היוון'), CF_LIST],
    compute: ({ r, cfs }) => {
      const bad = checkCfs(cfs, 'PI')
      if (bad) return bad
      if (cfs[0] >= 0) return err('PI', 'התזרים בשנה 0 (ההשקעה) צריך להיות שלילי')
      const pvF = npv(r, [0, ...cfs.slice(1)])
      const v = pvF / -cfs[0]
      return {
        label: 'PI',
        value: v,
        text: fmtFixed(v, 4),
        badge: v > 1 ? { tone: 'good', text: '✓ PI > 1 ← כדאי לקבל' } : { tone: 'bad', text: '✗ PI < 1 ← לדחות' },
        steps: [`ערך נוכחי של התזרימים העתידיים: $${tn(pvF)}$`, `$PI = \\frac{${tn(pvF)}}{${tn(-cfs[0])}} = ${tn(v, 4)}$`],
      }
    },
  },
  payback: {
    inputs: [CF_LIST, num('target', 'תקופת החזר מקסימלית (שנים)')],
    compute: ({ cfs, target }) => {
      const bad = checkCfs(cfs, 'החזר')
      if (bad) return bad
      const p = payback(cfs)
      const steps = p.cumulative.map((c, t) => `שנה ${t}: מצטבר $${tn(c)}$`)
      if (p.years === null) return { label: 'תקופת החזר', value: null, text: 'לא מוחזר', error: 'סכום התזרימים לא מכסה את ההשקעה', steps }
      const t = Math.ceil(p.years)
      steps.push(`ההשקעה מוחזרת במהלך שנה ${t}: $${t - 1} + \\frac{${tn(-p.cumulative[t - 1])}}{${tn(cfs[t])}} = ${tn(p.years)}$`)
      return {
        label: 'תקופת החזר',
        value: p.years,
        text: `${fmt(p.years, 2)} שנים`,
        badge: isFinite(target) && target > 0 ? (p.years <= target ? { tone: 'good', text: `✓ מתחת ל-${fmt(target)} שנים ← עומד ביעד` } : { tone: 'bad', text: `✗ מעל ${fmt(target)} שנים ← לא עומד ביעד` }) : undefined,
        steps,
      }
    },
  },
  discounted_payback: {
    inputs: [per('r', 'שיעור היוון'), CF_LIST],
    compute: ({ r, cfs }) => {
      const bad = checkCfs(cfs, 'החזר')
      if (bad) return bad
      const d = discountedCfs(cfs, r)
      const p = payback(d)
      const steps = d.map((x, t) => `שנה ${t}: מהוון $${tn(x)}$, מצטבר $${tn(p.cumulative[t])}$`)
      if (p.years === null) return { label: 'החזר מהוון', value: null, text: 'לא מוחזר', error: 'הערך הנוכחי של התזרימים לא מכסה את ההשקעה (NPV < 0)', steps }
      const t = Math.ceil(p.years)
      steps.push(`$${t - 1} + \\frac{${tn(-p.cumulative[t - 1])}}{${tn(d[t])}} = ${tn(p.years)}$ שנים`)
      return { label: 'תקופת החזר מהוונת', value: p.years, text: `${fmt(p.years, 2)} שנים`, steps }
    },
  },
  eaa: {
    inputs: [per('r', 'שיעור היוון'), CF_LIST],
    compute: ({ r, cfs }) => {
      const bad = checkCfs(cfs, 'EAA')
      if (bad) return bad
      const n = cfs.length - 1
      const v0 = npv(r, cfs)
      const f = annuityPvFactor(r, n)
      const v = v0 / f
      return {
        label: 'EAA',
        value: v,
        text: fmtFixed(v),
        extras: [`NPV = ${fmtFixed(v0)} על ${n} שנים`],
        steps: [`$NPV = ${tn(v0)}$`, `מקדם אנונה ל-${n} שנים: $${tn(f, 4)}$`, `$EAA = \\frac{${tn(v0)}}{${tn(f, 4)}} = ${tn(v)}$ לשנה`],
      }
    },
  },

  // ===== עלות הון =====
  capm: {
    inputs: [per('rf', 'ריבית חסרת סיכון (Rf)'), num('beta', 'ביטא (β)', true), per('rm', 'תשואת השוק (Rm)')],
    compute: ({ rf, beta, rm }) => {
      const v = rf + beta * (rm - rf)
      return {
        label: 'Re',
        value: v * 100,
        text: pct(v),
        extras: [`פרמיית סיכון שוק: ${pct(rm - rf)}`],
        steps: [`פרמיית השוק: $${tp(rm)} - ${tp(rf)} = ${tp(rm - rf)}$`, `$R_e = ${tp(rf)} + ${tn(beta)} \\times ${tp(rm - rf)} = ${tp(v)}$`],
      }
    },
  },
  gordon_price: {
    inputs: [num('d0', 'דיבידנד אחרון (D₀)'), per('g', 'שיעור צמיחה', true), per('r', 'תשואה נדרשת')],
    compute: ({ d0, g, r }) => {
      if (r <= g) return err('P₀', 'המודל תקף רק כשהתשואה הנדרשת גדולה משיעור הצמיחה')
      const d1 = d0 * (1 + g)
      const v = d1 / (r - g)
      return { label: 'P₀', value: v, text: fmtFixed(v), steps: [`$D_1 = ${tn(d0)} \\times ${tn(1 + g, 4)} = ${tn(d1, 4)}$`, `$P_0 = \\frac{${tn(d1, 4)}}{${tn(r, 4)} - ${tn(g, 4)}} = ${tn(v)}$`] }
    },
  },
  gordon_return: {
    inputs: [num('d1', 'דיבידנד צפוי (D₁)'), num('p0', 'מחיר המניה (P₀)'), per('g', 'שיעור צמיחה', true)],
    compute: ({ d1, p0, g }) => {
      const y = d1 / p0
      const v = y + g
      return { label: 'r', value: v * 100, text: pct(v), extras: [`תשואת דיבידנד: ${pct(y)}`], steps: [`תשואת דיבידנד: $\\frac{${tn(d1)}}{${tn(p0)}} = ${tp(y)}$`, `$r = ${tp(y)} + ${tp(g)} = ${tp(v)}$`] }
    },
  },
  kd_after_tax: {
    inputs: [per('kd', 'עלות חוב לפני מס (Rd)'), per('t', 'שיעור מס (T)')],
    compute: ({ kd, t }) => {
      const v = kd * (1 - t)
      return { label: 'Rd אחרי מס', value: v * 100, text: pct(v), extras: [`מגן מס: ${pct(kd * t)}`], steps: [`$R_d(1-T) = ${tp(kd)} \\times (1-${tn(t, 4)}) = ${tp(v)}$`] }
    },
  },
  wacc: {
    inputs: [num('e', 'שווי הון עצמי (E)'), num('d', 'שווי חוב (D)'), per('re', 'עלות הון עצמי (Re)'), per('rd', 'עלות חוב (Rd)'), per('t', 'שיעור מס (T)')],
    compute: ({ e, d, re, rd, t }) => {
      const V = e + d
      const we = e / V
      const wd = d / V
      const v = we * re + wd * rd * (1 - t)
      return {
        label: 'WACC',
        value: v * 100,
        text: pct(v),
        steps: [
          `$V = ${tn(e)} + ${tn(d)} = ${tn(V)}$`,
          `משקלים: $\\frac{E}{V} = ${tn(we, 4)}$, $\\frac{D}{V} = ${tn(wd, 4)}$`,
          `חלק ההון: $${tn(we, 4)} \\times ${tp(re)} = ${tp(we * re, 3)}$`,
          `חלק החוב אחרי מס: $${tn(wd, 4)} \\times ${tp(rd)} \\times (1-${tn(t, 4)}) = ${tp(wd * rd * (1 - t), 3)}$`,
          `$WACC = ${tp(we * re, 3)} + ${tp(wd * rd * (1 - t), 3)} = ${tp(v, 3)}$`,
        ],
      }
    },
  },
  beta_levered: {
    inputs: [num('bu', 'ביטא לא ממונפת (βU)'), num('de', 'יחס חוב להון (D/E)'), per('t', 'שיעור מס (T)')],
    compute: ({ bu, de, t }) => {
      const v = bu * (1 + (1 - t) * de)
      return { label: 'βL', value: v, text: fmtFixed(v, 4), steps: [`$1 + (1-${tn(t, 4)}) \\times ${tn(de, 4)} = ${tn(1 + (1 - t) * de, 4)}$`, `$\\beta_L = ${tn(bu, 4)} \\times ${tn(1 + (1 - t) * de, 4)} = ${tn(v, 4)}$`] }
    },
  },
  beta_unlevered: {
    inputs: [num('bl', 'ביטא ממונפת (βL)'), num('de', 'יחס חוב להון (D/E)'), per('t', 'שיעור מס (T)')],
    compute: ({ bl, de, t }) => {
      const v = bl / (1 + (1 - t) * de)
      return { label: 'βU', value: v, text: fmtFixed(v, 4), steps: [`$1 + (1-${tn(t, 4)}) \\times ${tn(de, 4)} = ${tn(1 + (1 - t) * de, 4)}$`, `$\\beta_U = \\frac{${tn(bl, 4)}}{${tn(1 + (1 - t) * de, 4)}} = ${tn(v, 4)}$`] }
    },
  },

  // ===== נזילות =====
  current_ratio: ratio('יחס שוטף', ['ca', 'נכסים שוטפים (CA)'], ['cl', 'התחייבויות שוטפות (CL)'], (v) => grade(v, (x) => x >= 1.5 && x <= 2, (x) => (x >= 1 && x < 1.5) || x > 2), {
    good: 'נזילות בריאה',
    ok: 'נזילות גבולית או עודף נכסים שוטפים',
    bad: 'פחות מ-1, קושי לכסות התחייבויות קצרות',
  }),
  quick_ratio: {
    inputs: [num('ca', 'נכסים שוטפים (CA)'), num('inv', 'מלאי'), num('cl', 'התחייבויות שוטפות (CL)')],
    compute: ({ ca, inv, cl }) => {
      if (cl === 0) return err('יחס מהיר', 'ההתחייבויות השוטפות לא יכולות להיות 0')
      const v = (ca - inv) / cl
      const tone = grade(v, (x) => x >= 1, (x) => x >= 0.7)
      return {
        label: 'יחס מהיר',
        value: v,
        text: fmtFixed(v),
        badge: ratioBadge(tone, { good: 'אפשר לכסות התחייבויות בלי למכור מלאי', ok: 'נזילות מהירה מעט נמוכה', bad: 'תלות גבוהה במכירת מלאי' }),
        steps: [`$${tn(ca)} - ${tn(inv)} = ${tn(ca - inv)}$`, `$\\frac{${tn(ca - inv)}}{${tn(cl)}} = ${tn(v)}$`],
      }
    },
  },
  cash_ratio: {
    inputs: [num('cash', 'מזומנים ושווי מזומנים + ני"ע סחירים'), num('cl', 'התחייבויות שוטפות (CL)')],
    compute: ({ cash, cl }) => {
      const v = cash / cl
      const tone = grade(v, (x) => x >= 0.5 && x <= 1, (x) => (x >= 0.2 && x < 0.5) || x > 1)
      return {
        label: 'יחס מזומנים',
        value: v,
        text: fmtFixed(v),
        badge: ratioBadge(tone, { good: 'כרית מזומנים טובה', ok: v > 1 ? 'הרבה מזומן לא מנוצל' : 'מקובל ברוב החברות', bad: 'מעט מאוד מזומן זמין' }),
        steps: [`$\\frac{${tn(cash)}}{${tn(cl)}} = ${tn(v)}$`],
      }
    },
  },
  nwc: {
    inputs: [num('ca', 'נכסים שוטפים (CA)'), num('cl', 'התחייבויות שוטפות (CL)')],
    compute: ({ ca, cl }) => {
      const v = ca - cl
      return {
        label: 'הון חוזר נטו',
        value: v,
        text: fmtFixed(v),
        badge: v > 0 ? { tone: 'good', text: '✓ חיובי – הנכסים השוטפים מכסים את ההתחייבויות' } : { tone: 'bad', text: '! שלילי – ייתכן לחץ נזילות' },
        steps: [`$NWC = ${tn(ca)} - ${tn(cl)} = ${tn(v)}$`],
      }
    },
  },
  ocf_ratio: ratio('יחס תזרים מפעולות', ['ocf', 'תזרים מפעולות שוטפות (CFO)', true], ['cl', 'התחייבויות שוטפות (CL)'], (v) => grade(v, (x) => x >= 1, (x) => x >= 0.5), {
    good: 'התזרים השוטף מכסה את ההתחייבויות',
    ok: 'כיסוי חלקי מהתזרים',
    bad: 'תזרים חלש ביחס להתחייבויות',
  }),

  // ===== מינוף ואיתנות =====
  debt_equity: ratio('D/E', ['d', 'סך החוב (D)'], ['e', 'הון עצמי (E)'], (v) => grade(v, (x) => x >= 0 && x <= 1, (x) => x > 1 && x <= 2), {
    good: 'מינוף מתון',
    ok: 'מינוף גבוה יחסית',
    bad: 'מינוף גבוה מאוד או הון שלילי',
  }),
  debt_assets: ratio('חוב/נכסים', ['d', 'סך החוב (D)'], ['a', 'סך הנכסים (A)'], (v) => grade(v, (x) => x <= 0.5, (x) => x <= 0.7), {
    good: 'רוב הנכסים ממומנים בהון',
    ok: 'מימון חוב משמעותי',
    bad: 'רוב הנכסים ממומנים בחוב',
  }),
  equity_multiplier: ratio('מכפיל הון', ['a', 'סך הנכסים (A)'], ['e', 'הון עצמי (E)'], (v) => grade(v, (x) => x >= 1 && x <= 2, (x) => x > 2 && x <= 3), {
    good: 'מינוף נמוך',
    ok: 'מינוף בינוני',
    bad: 'מינוף גבוה',
  }),
  tie: ratio('TIE', ['ebit', 'EBIT (רווח תפעולי)', true], ['int', 'הוצאות ריבית'], (v) => grade(v, (x) => x >= 3, (x) => x >= 1.5), {
    good: 'כיסוי ריבית נוח',
    ok: 'כיסוי ריבית דחוק',
    bad: 'הרווח בקושי מכסה את הריבית',
  }),
  netdebt_ebitda: {
    inputs: [num('debt', 'חוב פיננסי'), num('cash', 'מזומנים'), num('ebitda', 'EBITDA', true)],
    compute: ({ debt, cash, ebitda }) => {
      const nd = debt - cash
      const v = nd / ebitda
      const tone: Tone = ebitda <= 0 ? 'bad' : grade(v, (x) => x <= 2, (x) => x <= 4)
      return {
        label: 'חוב נטו/EBITDA',
        value: v,
        text: fmtFixed(v),
        badge: ratioBadge(tone, { good: 'אפשר להחזיר את החוב בכ-2 שנים או פחות', ok: 'מינוף משמעותי', bad: 'מינוף גבוה – סיכון אשראי' }),
        steps: [`חוב נטו: $${tn(debt)} - ${tn(cash)} = ${tn(nd)}$`, `$\\frac{${tn(nd)}}{${tn(ebitda)}} = ${tn(v)}$`],
      }
    },
  },
  dscr: ratio('DSCR', ['cfads', 'תזרים זמין לשירות חוב', true], ['ds', 'שירות חוב (קרן + ריבית)'], (v) => grade(v, (x) => x >= 1.25, (x) => x >= 1), {
    good: 'כיסוי חוב טוב',
    ok: 'כיסוי גבולי',
    bad: 'התזרים לא מכסה את שירות החוב',
  }),

  // ===== רווחיות =====
  gross_margin: {
    inputs: [num('rev', 'הכנסות'), num('cogs', 'עלות המכר')],
    compute: ({ rev, cogs }) => {
      const gp = rev - cogs
      const v = gp / rev
      return {
        label: 'רווח גולמי',
        value: v * 100,
        text: pct(v),
        badge: ratioBadge(grade(v, (x) => x >= 0.4, (x) => x >= 0.2), { good: 'מרווח גולמי גבוה', ok: 'מרווח בינוני', bad: 'מרווח נמוך' }),
        steps: [`רווח גולמי: $${tn(rev)} - ${tn(cogs)} = ${tn(gp)}$`, `$\\frac{${tn(gp)}}{${tn(rev)}} = ${tp(v)}$`],
      }
    },
  },
  operating_margin: margin('שיעור רווח תפעולי', ['ebit', 'רווח תפעולי (EBIT)'], 0.15, 0.05),
  net_margin: margin('שיעור רווח נקי', ['ni', 'רווח נקי'], 0.1, 0.05),
  ebitda_margin: margin('EBITDA margin', ['ebitda', 'EBITDA'], 0.2, 0.1),
  roa: margin('ROA', ['ni', 'רווח נקי'], 0.05, 0.02, ['assets', 'סך נכסים (ממוצע)']),
  roe: margin('ROE', ['ni', 'רווח נקי'], 0.15, 0.08, ['equity', 'הון עצמי (ממוצע)']),
  roic: {
    inputs: [num('ebit', 'רווח תפעולי (EBIT)', true), per('t', 'שיעור מס (T)'), num('ic', 'הון מושקע (חוב + הון)')],
    compute: ({ ebit, t, ic }) => {
      const nopat = ebit * (1 - t)
      const v = nopat / ic
      return {
        label: 'ROIC',
        value: v * 100,
        text: pct(v),
        badge: ratioBadge(grade(v, (x) => x >= 0.12, (x) => x >= 0.06), { good: 'כנראה מעל עלות ההון – יוצר ערך', ok: 'השוו ל-WACC', bad: 'כנראה מתחת לעלות ההון' }),
        steps: [`$NOPAT = ${tn(ebit)} \\times (1-${tn(t, 4)}) = ${tn(nopat)}$`, `$ROIC = \\frac{${tn(nopat)}}{${tn(ic)}} = ${tp(v)}$`],
      }
    },
  },
  dupont: {
    inputs: [num('ni', 'רווח נקי', true), num('rev', 'הכנסות'), num('assets', 'סך נכסים'), num('equity', 'הון עצמי')],
    compute: ({ ni, rev, assets, equity }) => {
      const m = ni / rev
      const t = rev / assets
      const em = assets / equity
      const v = m * t * em
      return {
        label: 'ROE',
        value: v * 100,
        text: pct(v),
        extras: [`רווחיות ${pct(m)} × מחזור ${fmt(t, 2)} × מינוף ${fmt(em, 2)}`],
        steps: [
          `שיעור רווח נקי: $\\frac{${tn(ni)}}{${tn(rev)}} = ${tp(m)}$`,
          `מחזור נכסים: $\\frac{${tn(rev)}}{${tn(assets)}} = ${tn(t, 4)}$`,
          `מכפיל הון: $\\frac{${tn(assets)}}{${tn(equity)}} = ${tn(em, 4)}$`,
          `$ROE = ${tp(m)} \\times ${tn(t, 4)} \\times ${tn(em, 4)} = ${tp(v)}$`,
        ],
      }
    },
  },

  // ===== פעילות =====
  inventory_turnover: ratio('מחזור מלאי', ['cogs', 'עלות המכר'], ['inv', 'מלאי ממוצע'], (v) => grade(v, (x) => x >= 8, (x) => x >= 4), {
    good: 'המלאי מסתובב מהר',
    ok: 'קצב סביר',
    bad: 'מלאי איטי – סיכון להתיישנות',
  }),
  dio: days('DIO', ['inv', 'מלאי ממוצע'], ['cogs', 'עלות המכר (שנתית)'], 45, 90, { good: 'מלאי מוחזק זמן קצר', ok: 'זמן החזקה בינוני', bad: 'מלאי מוחזק זמן רב' }),
  dso: days('DSO', ['ar', 'לקוחות (חייבים) ממוצע'], ['rev', 'הכנסות (שנתיות)'], 45, 75, { good: 'גבייה מהירה', ok: 'גבייה בינונית', bad: 'גבייה איטית – בדקו את איכות הלקוחות' }),
  dpo: {
    inputs: [num('ap', 'ספקים ממוצע'), num('cogs', 'עלות המכר (שנתית)')],
    compute: ({ ap, cogs }) => {
      const v = (ap / cogs) * 365
      const tone = grade(v, (x) => x >= 30 && x <= 60, (x) => x < 30 || x <= 90)
      return {
        label: 'DPO',
        value: v,
        text: `${fmt(v, 1)} ימים`,
        badge: ratioBadge(tone, { good: 'אשראי ספקים מאוזן', ok: v < 30 ? 'משלמים מהר – לא מנצלים אשראי ספקים' : 'אשראי ספקים ארוך', bad: 'תשלום איטי מאוד – ייתכן קושי לשלם' }),
        steps: [`$\\frac{${tn(ap)}}{${tn(cogs)}} \\times 365 = ${tn(v, 1)}$ ימים`],
      }
    },
  },
  ccc: {
    inputs: [num('dio', 'DIO (ימי מלאי)'), num('dso', 'DSO (ימי לקוחות)'), num('dpo', 'DPO (ימי ספקים)')],
    compute: ({ dio, dso, dpo }) => {
      const v = dio + dso - dpo
      const tone = grade(v, (x) => x <= 30, (x) => x <= 90)
      return {
        label: 'CCC',
        value: v,
        text: `${fmt(v, 1)} ימים`,
        badge: ratioBadge(tone, { good: 'מחזור מזומנים קצר', ok: 'צורך מימון בינוני להון חוזר', bad: 'מחזור ארוך – צורך מימון גבוה' }),
        steps: [`$CCC = ${tn(dio, 1)} + ${tn(dso, 1)} - ${tn(dpo, 1)} = ${tn(v, 1)}$ ימים`],
      }
    },
  },
  asset_turnover: ratio('מחזור נכסים', ['rev', 'הכנסות'], ['assets', 'סך נכסים (ממוצע)'], (v) => grade(v, (x) => x >= 1, (x) => x >= 0.5), {
    good: 'ניצול נכסים יעיל',
    ok: 'ניצול בינוני (מקובל בענפים עתירי נכסים)',
    bad: 'ניצול נכסים נמוך',
  }),
  receivables_turnover: ratio('מחזור לקוחות', ['rev', 'הכנסות (באשראי)'], ['ar', 'לקוחות ממוצע'], (v) => grade(v, (x) => x >= 8, (x) => x >= 5), {
    good: 'גבייה מהירה',
    ok: 'גבייה סבירה',
    bad: 'גבייה איטית',
  }),

  // ===== אג"ח =====
  bond_price: {
    inputs: [num('face', 'ערך נקוב (F)'), per('cr', 'ריבית קופון שנתית'), per('y', 'תשואה לפדיון (YTM)'), num('years', 'שנים לפדיון'), int('freq', 'תשלומי קופון בשנה')],
    compute: ({ face, cr, y, years, freq }) => {
      const b = { face, couponRate: cr, years, freq }
      const n = Math.round(years * freq)
      const c = (face * cr) / freq
      const yy = y / freq
      const pvC = c * annuityPvFactor(yy, n)
      const pvF = face / Math.pow(1 + yy, n)
      const v = bondPrice(b, y)
      return {
        label: 'מחיר',
        value: v,
        text: fmtFixed(v),
        badge: v < face - 1e-9 ? { tone: 'info', text: 'נסחרת בניכיון (קופון < תשואה)' } : v > face + 1e-9 ? { tone: 'info', text: 'נסחרת בפרמיה (קופון > תשואה)' } : { tone: 'info', text: 'נסחרת לפי ערך נקוב' },
        steps: [
          `קופון לתקופה: $C = \\frac{${tn(face)} \\times ${tn(cr, 4)}}{${freq}} = ${tn(c)}$, תשואה לתקופה $${tn(yy, 5)}$, $n = ${n}$`,
          `ערך נוכחי של הקופונים: $${tn(c)} \\times ${tn(annuityPvFactor(yy, n), 4)} = ${tn(pvC)}$`,
          `ערך נוכחי של הקרן: $\\frac{${tn(face)}}{(1+${tn(yy, 5)})^{${n}}} = ${tn(pvF)}$`,
          `$P = ${tn(pvC)} + ${tn(pvF)} = ${tn(v)}$`,
        ],
      }
    },
  },
  current_yield: {
    inputs: [num('c', 'קופון שנתי (בכסף)'), num('p', 'מחיר שוק')],
    compute: ({ c, p }) => {
      const v = c / p
      return { label: 'תשואה שוטפת', value: v * 100, text: pct(v), steps: [`$CY = \\frac{${tn(c)}}{${tn(p)}} = ${tp(v)}$`] }
    },
  },
  ytm_approx: {
    inputs: [num('c', 'קופון שנתי (בכסף)'), num('f', 'ערך נקוב (F)'), num('p', 'מחיר שוק (P)'), num('n', 'שנים לפדיון (n)')],
    compute: ({ c, f, p, n }) => {
      const num_ = c + (f - p) / n
      const den = (f + p) / 2
      const v = num_ / den
      return {
        label: 'YTM (קירוב)',
        value: v * 100,
        text: pct(v),
        steps: [`מונה: $${tn(c)} + \\frac{${tn(f)} - ${tn(p)}}{${tn(n)}} = ${tn(num_, 3)}$`, `מכנה: $\\frac{${tn(f)} + ${tn(p)}}{2} = ${tn(den)}$`, `$YTM \\approx \\frac{${tn(num_, 3)}}{${tn(den)}} = ${tp(v)}$`],
      }
    },
  },
  ytm: {
    inputs: [num('face', 'ערך נקוב (F)'), per('cr', 'ריבית קופון שנתית'), num('price', 'מחיר שוק (P)'), num('years', 'שנים לפדיון'), int('freq', 'תשלומי קופון בשנה')],
    compute: ({ face, cr, price, years, freq }) => {
      const b = { face, couponRate: cr, years, freq }
      const v = bondYtm(b, price)
      if (v === null) return err('YTM', 'לא נמצאה תשואה שמתאימה למחיר. בדקו את הנתונים')
      return {
        label: 'YTM',
        value: v * 100,
        text: pct(v, 2),
        extras: freq > 1 ? [`תשואה אפקטיבית שנתית: ${pct(Math.pow(1 + v / freq, freq) - 1)}`] : [],
        steps: [
          `מחפשים $y$ שעבורו מחיר האג"ח בנוסחה שווה ל-$${tn(price)}$ (בייסקשן).`,
          `ב-$y = ${tp(v - 0.01)}$: $P = ${tn(bondPrice(b, v - 0.01))}$; ב-$y = ${tp(v + 0.01)}$: $P = ${tn(bondPrice(b, v + 0.01))}$`,
          `התכנסות: $P(${tp(v, 4)}) = ${tn(bondPrice(b, v))}$`,
        ],
      }
    },
  },
  macaulay: {
    inputs: [num('face', 'ערך נקוב (F)'), per('cr', 'ריבית קופון שנתית'), per('y', 'תשואה לפדיון (YTM)'), num('years', 'שנים לפדיון'), int('freq', 'תשלומי קופון בשנה')],
    compute: ({ face, cr, y, years, freq }) => {
      const b = { face, couponRate: cr, years, freq }
      const v = macaulayDuration(b, y)
      const p = bondPrice(b, y)
      return {
        label: 'מח"מ מקולי',
        value: v,
        text: `${fmtFixed(v, 2)} שנים`,
        steps: [
          `מחיר האג"ח: $P = ${tn(p)}$`,
          `לכל תשלום: זמן × ערך נוכחי, מחולק במחיר: $D = \\frac{\\sum t \\cdot PV(CF_t)}{P}$`,
          `$\\sum t \\cdot PV(CF_t) = ${tn(v * p)}$`,
          `$D = \\frac{${tn(v * p)}}{${tn(p)}} = ${tn(v, 4)}$ שנים`,
        ],
      }
    },
  },
  modified_duration: {
    inputs: [num('face', 'ערך נקוב (F)'), per('cr', 'ריבית קופון שנתית'), per('y', 'תשואה לפדיון (YTM)'), num('years', 'שנים לפדיון'), int('freq', 'תשלומי קופון בשנה')],
    compute: ({ face, cr, y, years, freq }) => {
      const b = { face, couponRate: cr, years, freq }
      const d = macaulayDuration(b, y)
      const v = d / (1 + y / freq)
      return {
        label: 'מח"מ מתואם',
        value: v,
        text: fmtFixed(v, 2),
        extras: [`עלייה של 1% בתשואה ← ירידה של כ-${fmt(v, 2)}% במחיר`],
        steps: [`מח"מ מקולי: $D = ${tn(d, 4)}$`, `$D^* = \\frac{${tn(d, 4)}}{1+\\frac{${tn(y, 4)}}{${freq}}} = ${tn(v, 4)}$`],
      }
    },
  },

  // ===== שוק ומכפילים =====
  eps: {
    inputs: [num('ni', 'רווח נקי', true), num('pref', 'דיבידנד למניות בכורה'), num('shares', 'מספר מניות (ממוצע משוקלל)')],
    compute: ({ ni, pref, shares }) => {
      const v = (ni - pref) / shares
      return { label: 'EPS', value: v, text: fmtFixed(v), steps: [`$EPS = \\frac{${tn(ni)} - ${tn(pref)}}{${tn(shares)}} = ${tn(v)}$`] }
    },
  },
  pe: {
    inputs: [num('p', 'מחיר המניה'), num('eps', 'רווח למניה (EPS)', true)],
    compute: ({ p, eps }) => {
      const v = p / eps
      const tone: Tone = eps <= 0 ? 'bad' : grade(v, (x) => x >= 8 && x <= 20, (x) => x > 20 && x <= 30)
      return {
        label: 'P/E',
        value: v,
        text: eps <= 0 ? 'לא משמעותי' : fmtFixed(v),
        badge: ratioBadge(tone, { good: 'מכפיל טיפוסי', ok: 'מכפיל גבוה – השוק מצפה לצמיחה', bad: eps <= 0 ? 'הפסד – המכפיל לא משמעותי' : v < 8 ? 'מכפיל נמוך מאוד – זול או מסוכן' : 'מכפיל גבוה מאוד' }),
        steps: [`$P/E = \\frac{${tn(p)}}{${tn(eps)}} = ${tn(v)}$`],
      }
    },
  },
  pb: {
    inputs: [num('p', 'מחיר המניה'), num('bvps', 'הון עצמי למניה (BVPS)', true)],
    compute: ({ p, bvps }) => {
      const v = p / bvps
      const tone: Tone = bvps <= 0 ? 'bad' : grade(v, (x) => x >= 1 && x <= 3, (x) => x < 1 || x <= 5)
      return {
        label: 'P/B',
        value: v,
        text: fmtFixed(v),
        badge: ratioBadge(tone, { good: 'טווח טיפוסי', ok: v < 1 ? 'מתחת להון – זול או בעייתי' : 'פרמיה גבוהה על ההון', bad: 'הון שלילי או מכפיל קיצוני' }),
        steps: [`$P/B = \\frac{${tn(p)}}{${tn(bvps)}} = ${tn(v)}$`],
      }
    },
  },
  dividend_yield: {
    inputs: [num('dps', 'דיבידנד שנתי למניה (DPS)'), num('p', 'מחיר המניה')],
    compute: ({ dps, p }) => {
      const v = dps / p
      const tone = grade(v, (x) => x >= 0.02 && x <= 0.06, (x) => x < 0.02 || x <= 0.08)
      return {
        label: 'תשואת דיבידנד',
        value: v * 100,
        text: pct(v),
        badge: ratioBadge(tone, { good: 'תשואה מקובלת', ok: v < 0.02 ? 'חלוקה נמוכה' : 'תשואה גבוהה – בדקו קיימות', bad: 'תשואה חריגה – אולי המחיר צנח' }),
        steps: [`$\\frac{${tn(dps)}}{${tn(p)}} = ${tp(v)}$`],
      }
    },
  },
  payout_ratio: {
    inputs: [num('dps', 'דיבידנד למניה (DPS)'), num('eps', 'רווח למניה (EPS)', true)],
    compute: ({ dps, eps }) => {
      const v = dps / eps
      const tone: Tone = eps <= 0 ? 'bad' : grade(v, (x) => x >= 0.3 && x <= 0.6, (x) => x < 0.3 || x <= 0.8)
      return {
        label: 'שיעור חלוקה',
        value: v * 100,
        text: pct(v),
        extras: [`שיעור שימור (b): ${pct(1 - v)}`],
        badge: ratioBadge(tone, { good: 'חלוקה מאוזנת', ok: v < 0.3 ? 'רוב הרווח מושקע מחדש' : 'חלוקה גבוהה', bad: 'מחלקים יותר מהרווח' }),
        steps: [`$\\frac{${tn(dps)}}{${tn(eps)}} = ${tp(v)}$`, `שיעור שימור: $1 - ${tn(v, 4)} = ${tp(1 - v)}$`],
      }
    },
  },
  ev_ebitda: {
    inputs: [num('mcap', 'שווי שוק (הון)'), num('debt', 'חוב'), num('cash', 'מזומנים'), num('ebitda', 'EBITDA', true)],
    compute: ({ mcap, debt, cash, ebitda }) => {
      const ev = mcap + debt - cash
      const v = ev / ebitda
      const tone: Tone = ebitda <= 0 ? 'bad' : grade(v, (x) => x <= 10, (x) => x <= 15)
      return {
        label: 'EV/EBITDA',
        value: v,
        text: fmtFixed(v),
        extras: [`EV = ${fmtFixed(ev)}`],
        badge: ratioBadge(tone, { good: 'מכפיל טיפוסי', ok: 'מכפיל גבוה', bad: 'מכפיל גבוה מאוד או EBITDA שלילי' }),
        steps: [`$EV = ${tn(mcap)} + ${tn(debt)} - ${tn(cash)} = ${tn(ev)}$`, `$\\frac{${tn(ev)}}{${tn(ebitda)}} = ${tn(v)}$`],
      }
    },
  },
  peg: {
    inputs: [num('pe', 'מכפיל רווח (P/E)'), per('g', 'צמיחה שנתית צפויה ברווח')],
    compute: ({ pe, g }) => {
      const v = pe / (g * 100)
      const tone = grade(v, (x) => x > 0 && x <= 1, (x) => x > 1 && x <= 2)
      return {
        label: 'PEG',
        value: v,
        text: fmtFixed(v),
        badge: ratioBadge(tone, { good: 'המכפיל מוצדק בצמיחה', ok: 'מחיר מלא ביחס לצמיחה', bad: 'יקר ביחס לצמיחה' }),
        steps: [`$PEG = \\frac{${tn(pe)}}{${tn(g * 100)}} = ${tn(v)}$`],
      }
    },
  },
}

// ---------- יצרני מחשבונים גנריים ----------

function ratio(label: string, a: [string, string, boolean?], b: [string, string], toneOf: (v: number) => Tone, texts: Partial<Record<Tone, string>>): Calculator {
  return {
    inputs: [num(a[0], a[1], !!a[2]), num(b[0], b[1])],
    compute: (v) => {
      const x = v[a[0]] as number
      const y = v[b[0]] as number
      if (y === 0) return err(label, 'המכנה לא יכול להיות 0')
      const r = x / y
      return { label, value: r, text: fmtFixed(r), badge: ratioBadge(toneOf(r), texts), steps: [`$\\frac{${tn(x)}}{${tn(y)}} = ${tn(r, 4)}$`] }
    },
  }
}

function margin(label: string, a: [string, string], good: number, ok: number, b: [string, string] = ['rev', 'הכנסות']): Calculator {
  return {
    inputs: [num(a[0], a[1], true), num(b[0], b[1])],
    compute: (v) => {
      const x = v[a[0]] as number
      const y = v[b[0]] as number
      if (y === 0) return err(label, 'המכנה לא יכול להיות 0')
      const r = x / y
      const tone = grade(r, (z) => z >= good, (z) => z >= ok)
      return {
        label,
        value: r * 100,
        text: pct(r),
        badge: ratioBadge(tone, { good: `מעל ${pct(good, 0)}`, ok: `בין ${pct(ok, 0)} ל-${pct(good, 0)}`, bad: `מתחת ל-${pct(ok, 0)}` }),
        steps: [`$\\frac{${tn(x)}}{${tn(y)}} = ${tp(r)}$`],
      }
    },
  }
}

function days(label: string, a: [string, string], b: [string, string], good: number, ok: number, texts: Partial<Record<Tone, string>>): Calculator {
  return {
    inputs: [num(a[0], a[1]), num(b[0], b[1])],
    compute: (v) => {
      const x = v[a[0]] as number
      const y = v[b[0]] as number
      if (y === 0) return err(label, 'המכנה לא יכול להיות 0')
      const r = (x / y) * 365
      return {
        label,
        value: r,
        text: `${fmt(r, 1)} ימים`,
        badge: ratioBadge(grade(r, (z) => z <= good, (z) => z <= ok), texts),
        steps: [`$\\frac{${tn(x)}}{${tn(y)}} \\times 365 = ${tn(r, 1)}$ ימים`],
      }
    },
  }
}

// ---------- הרצה ----------

/** מריץ מחשבון על ערכים גולמיים מהטופס (מחרוזות). אחוזים מומרים לשבר עשרוני. */
export function runCalculator(calc: Calculator, raw: Record<string, string | number>): CalcResult {
  const v: Record<string, any> = {}
  for (const inp of calc.inputs) {
    const s = raw[inp.key] ?? ''
    if (inp.kind === 'list') {
      v[inp.key] = parseList(String(s))
    } else {
      const x = parseNum(String(s))
      if (!isFinite(x)) return err('', `יש להזין ערך מספרי בשדה "${inp.label}"`)
      if (inp.kind === 'int' && (x <= 0 || Math.round(x) !== x)) return err('', `"${inp.label}" צריך להיות מספר שלם חיובי`)
      v[inp.key] = inp.kind === 'pct' ? x / 100 : x
    }
  }
  try {
    const res = calc.compute(v as Vals)
    if (res.value !== null && !isFinite(res.value)) return { ...res, value: null, text: '—', error: res.error ?? 'החישוב לא מוגדר עבור הערכים האלה (חלוקה באפס?)' }
    return res
  } catch {
    return err('', 'שגיאה בחישוב. בדקו את הערכים')
  }
}
