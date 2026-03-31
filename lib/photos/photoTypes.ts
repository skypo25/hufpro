/**
 * Slot-Keys für standardisierte Huf-Fotos.
 * photo_type in DB und Dateiname im Storage.
 */
export const SLOT_SOLAR = [
  'VL_solar',
  'VR_solar',
  'HL_solar',
  'HR_solar',
] as const

export const SLOT_LATERAL = [
  'VL_lateral',
  'VR_lateral',
  'HL_lateral',
  'HR_lateral',
] as const

export const SLOT_WHOLE_BODY = ['whole_left', 'whole_right'] as const

export type SlotSolar = (typeof SLOT_SOLAR)[number]
export type SlotLateral = (typeof SLOT_LATERAL)[number]
export type SlotWholeBody = (typeof SLOT_WHOLE_BODY)[number]
export type PhotoSlotKey = SlotSolar | SlotLateral | SlotWholeBody

export const SLOT_LABELS: Record<string, string> = {
  VL_solar: 'VL Sohle',
  VR_solar: 'VR Sohle',
  HL_solar: 'HL Sohle',
  HR_solar: 'HR Sohle',
  VL_lateral: 'VL Lateral',
  VR_lateral: 'VR Lateral',
  HL_lateral: 'HL Lateral',
  HR_lateral: 'HR Lateral',
  whole_left: 'Ganzkörper links',
  whole_right: 'Ganzkörper rechts',
}

/** Legacy mobile keys (solar_vl, lateral_vl) → canonical (VL_solar, VL_lateral). Für Rückwärtskompatibilität. */
const LEGACY_TO_CANONICAL: Record<string, PhotoSlotKey> = {
  solar_vl: 'VL_solar', solar_vr: 'VR_solar', solar_hl: 'HL_solar', solar_hr: 'HR_solar',
  lateral_vl: 'VL_lateral', lateral_vr: 'VR_lateral', lateral_hl: 'HL_lateral', lateral_hr: 'HR_lateral',
}

/** photo_type aus DB → kanonischer Slot-Key. Mapped legacy (solar_vl) und akzeptiert bereits kanonische (VL_solar). */
export function toCanonicalPhotoSlot(photoType: string | null): PhotoSlotKey | null {
  if (!photoType) return null
  const canonical = LEGACY_TO_CANONICAL[photoType] ?? (photoType as PhotoSlotKey)
  const valid = [...SLOT_SOLAR, ...SLOT_LATERAL, ...SLOT_WHOLE_BODY]
  return valid.includes(canonical) ? canonical : null
}

/** Zielseitenverhältnis: Hufbilder hochkant 9:16 */
export const ASPECT_HOOF = 9 / 16
/** Ganzkörper Querformat 4:3 (wie processWholeBodyImage) */
export const ASPECT_WHOLE = 4 / 3

/** Max. längere Kante Huf (9:16) */
export const MAX_DIMENSION_HOOF = 850
/** Max. Breite Ganzkörper (quer, 4:3) */
export const MAX_DIMENSION_WHOLE = 850
/** JPEG-Qualität Huf / Ganzkörper (imageProcessing) */
export const JPEG_QUALITY_HOOF = 0.72
export const JPEG_QUALITY_WHOLE = 0.75
/** @deprecated Nutze JPEG_QUALITY_HOOF */
export const JPEG_QUALITY = JPEG_QUALITY_HOOF
