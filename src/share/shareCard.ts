// כרטיס שיתוף לסטורי (1080x1920), מצויר ב-Canvas בצד הלקוח.
// משתפים דרך Web Share API (וואטסאפ, אינסטגרם...), ואם אין תמיכה – מורידים את הקובץ.

export interface ShareCardData {
  /** כותרת גדולה, למשל "דנה ניצח/ה!" */
  title: string
  /** שורת ניקוד, למשל "10 שירים בציר" */
  score: string
  /** שורה קטנה (מצב משחק / תאריך) */
  subtitle: string
  /** ציר הזמן המנצח */
  timeline: { name: string; artists: string; year: number }[]
}

export const W = 1080
export const H = 1920
const FONT = 'system-ui, -apple-system, "Segoe UI", Arial, sans-serif'

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** מקצר טקסט כך שייכנס ברוחב נתון */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1)
  return t + '…'
}

/** כמה שורות של שירים נכנסות, והאם צריך שורת "ועוד X" */
export function layoutRows(count: number, maxRows = 12): { shown: number; more: number } {
  if (count <= maxRows) return { shown: count, more: 0 }
  return { shown: maxRows - 1, more: count - (maxRows - 1) }
}

export async function drawShareCard(data: ShareCardData): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.direction = 'rtl'

  // רקע: לילה סגול עם זוהר
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#1e0b3a')
  bg.addColorStop(0.55, '#0f0a1e')
  bg.addColorStop(1, '#3b0d2e')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W / 2, 330, 40, W / 2, 330, 620)
  glow.addColorStop(0, 'rgba(236,72,153,0.45)')
  glow.addColorStop(1, 'rgba(236,72,153,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, 900)

  // אייקון + שם האפליקציה
  const icon = await loadImage('/icon-512.png')
  if (icon) ctx.drawImage(icon, W / 2 - 110, 110, 220, 220)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font = `900 64px ${FONT}`
  ctx.fillText('היטסטר', W / 2, 400)

  // מנצח וניקוד
  ctx.font = `900 96px ${FONT}`
  ctx.fillStyle = '#fde047'
  ctx.fillText(fit(ctx, data.title, W - 120), W / 2, 560)
  ctx.font = `700 56px ${FONT}`
  ctx.fillStyle = '#4ade80'
  ctx.fillText(data.score, W / 2, 650)
  ctx.font = `400 36px ${FONT}`
  ctx.fillStyle = '#c4b5fd'
  ctx.fillText(data.subtitle, W / 2, 715)

  // ציר הזמן: שורות מהשנה המוקדמת למאוחרת
  const top = 790
  const rowH = 82
  const { shown, more } = layoutRows(data.timeline.length)
  const rows = data.timeline.slice(0, shown)
  rows.forEach((s, i) => {
    const y = top + i * rowH
    roundRect(ctx, 70, y, W - 140, rowH - 14, 22)
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.12)'
    ctx.fill()
    // שנה – בצד ימין
    ctx.textAlign = 'right'
    ctx.font = `900 46px ${FONT}`
    ctx.fillStyle = '#fde047'
    ctx.fillText(String(s.year), W - 100, y + 52)
    // שם השיר – אמן
    ctx.font = `600 34px ${FONT}`
    ctx.fillStyle = '#ffffff'
    ctx.fillText(fit(ctx, `${s.name} – ${s.artists}`, W - 400), W - 260, y + 48)
  })
  if (more) {
    ctx.textAlign = 'center'
    ctx.font = `600 36px ${FONT}`
    ctx.fillStyle = '#c4b5fd'
    ctx.fillText(`ועוד ${more} שירים…`, W / 2, top + shown * rowH + 50)
  }

  // תחתית
  ctx.textAlign = 'center'
  ctx.font = `400 34px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.fillText('נחשו מתי יצא השיר 🎵', W / 2, H - 80)
  return canvas
}

/** משתף את התמונה (או מוריד אותה אם אין Web Share). מחזיר מה קרה. */
export async function shareCanvas(canvas: HTMLCanvasElement, filename: string, text: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob: Blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('יצירת התמונה נכשלה'))), 'image/png'))
  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'היטסטר', text })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // שיתוף נכשל – ממשיכים להורדה
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return 'downloaded'
}
