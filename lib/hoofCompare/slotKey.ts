import type { HoofKey } from '@/lib/hoofs'
import type { PhotoSlotKey } from '@/lib/photos/photoTypes'
import type { HoofCompareView } from './types'

const HOOF_TO_PREFIX: Record<HoofKey, string> = {
  vl: 'VL',
  vr: 'VR',
  hl: 'HL',
  hr: 'HR',
}

/** Baut den kanonischen documentation_photos.photo_type-Schlüssel (z. B. VL_solar). */
export function photoSlotKeyFromHoofView(hoof: HoofKey, view: HoofCompareView): PhotoSlotKey {
  const suffix = view === 'solar' ? '_solar' : '_lateral'
  return `${HOOF_TO_PREFIX[hoof]}${suffix}` as PhotoSlotKey
}
