import type { HoofKey } from '@/lib/hoofs'

/** Ansicht für Slot-Key (Solar = Sohle, Lateral = Seite) */
export type HoofCompareView = 'solar' | 'lateral'

export function isHoofKey(v: string): v is HoofKey {
  return v === 'vl' || v === 'vr' || v === 'hl' || v === 'hr'
}

export function isHoofCompareView(v: string): v is HoofCompareView {
  return v === 'solar' || v === 'lateral'
}
