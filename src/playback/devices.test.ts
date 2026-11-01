import { describe, expect, it } from 'vitest'
import { simplifyDevices } from './devices'
import type { Device } from './controller'

const d = (id: string, name: string, type: string): Device => ({ id, name, type, is_active: false, is_restricted: false })
const all = [
  d('phone', 'OnePlus 15', 'Smartphone'),
  d('web1', 'Web Player (Chrome)', 'Computer'),
  d('web2', 'Web Player (Chrome)', 'Computer'),
  d('sdk', 'היטסטר (דפדפן במחשב)', 'Computer'),
  d('spk', 'Living Room', 'Speaker'),
]

describe('רשימת מכשירים פשוטה', () => {
  it('במחשב: רק הטלפון ברשימה הראשית (למחשב יש כפתור "המחשב הזה")', () => {
    const r = simplifyDevices(all, { mobile: false, ownId: 'sdk' })
    expect(r.main.map((c) => c.device.id)).toEqual(['phone'])
    expect(r.others.map((c) => c.device.id)).toEqual(['web1', 'web2', 'spk'])
  })

  it('בטלפון: הטלפון + מחשב אחד (עדיפות לנגן של המשחק)', () => {
    const r = simplifyDevices(all, { mobile: true, ownId: null })
    expect(r.main.map((c) => [c.device.id, c.label])).toEqual([
      ['phone', 'הטלפון – OnePlus 15'],
      ['sdk', 'המחשב'],
    ])
  })

  it('בטלפון בלי נגן משחק במחשב: אפליקציית ספוטיפיי במחשב לפני נגן הווב', () => {
    const r = simplifyDevices([d('web', 'Web Player (Chrome)', 'Computer'), d('app', 'GILAD-PC', 'Computer')], { mobile: true, ownId: null })
    expect(r.main.map((c) => c.device.id)).toEqual(['app'])
  })
})
