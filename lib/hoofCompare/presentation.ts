import type { HoofKey } from '@/lib/hoofs'
import type { HoofCompareView } from './types'

const HOOF_LONG: Record<HoofKey, string> = {
  vl: 'VL — Vorne Links',
  vr: 'VR — Vorne Rechts',
  hl: 'HL — Hinten Links',
  hr: 'HR — Hinten Rechts',
}

export function hoofLongLabel(hoof: HoofKey): string {
  return HOOF_LONG[hoof]
}

/** Text unter dem Foto (HTML-Vorlage: „VR — Sohlenansicht (Solar)“). */
export function photoOverlayTitle(hoof: HoofKey, view: HoofCompareView): string {
  if (view === 'solar') return `${hoof.toUpperCase()} — Sohlenansicht (Solar)`
  return `${hoof.toUpperCase()} — Seitenansicht (Lateral)`
}
