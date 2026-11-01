// רשימת מכשירים פשוטה: "המחשב" ו"הטלפון" – ושאר המכשירים מוסתרים מאחורי "מכשירים נוספים".
import type { Device } from './controller'

export interface DeviceChoice {
  device: Device
  label: string
  icon: string
}

const isHitsterPlayer = (d: Device) => d.name.startsWith('היטסטר')
const isWebPlayer = (d: Device) => /web player/i.test(d.name)
const isPhone = (d: Device) => d.type === 'Smartphone' || d.type === 'Tablet'

/**
 * מסדר את המכשירים:
 * - main: טלפונים, ומחשב אחד (רק כשהמשחק פתוח בטלפון – במחשב יש כפתור "המחשב הזה").
 *   עדיפות למחשב: נגן המשחק בדפדפן > אפליקציית ספוטיפיי במחשב > נגן הווב של ספוטיפיי.
 * - others: כל השאר (רמקולים, טלוויזיות, לשוניות נוספות של נגן הווב...)
 */
export function simplifyDevices(devices: Device[], opts: { mobile: boolean; ownId: string | null }): { main: DeviceChoice[]; others: DeviceChoice[] } {
  const list = devices.filter((d) => d.id !== opts.ownId)
  const main: DeviceChoice[] = []
  const phones = list.filter(isPhone)
  phones.forEach((d) => main.push({ device: d, label: phones.length > 1 ? `הטלפון (${d.name})` : `הטלפון – ${d.name}`, icon: '📱' }))

  if (opts.mobile) {
    const computers = list.filter((d) => d.type === 'Computer')
    const best = computers.find(isHitsterPlayer) ?? computers.find((d) => !isWebPlayer(d)) ?? computers[0]
    if (best) main.push({ device: best, label: 'המחשב', icon: '💻' })
  }

  const chosen = new Set(main.map((c) => c.device.id))
  const others = list
    .filter((d) => !chosen.has(d.id))
    .map((d) => ({ device: d, label: isHitsterPlayer(d) ? 'המשחק בדפדפן במחשב' : d.name, icon: isPhone(d) ? '📱' : d.type === 'Speaker' ? '🔊' : d.type === 'TV' ? '📺' : '💻' }))
  return { main, others }
}
