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

/** Zielseitenverhältnis: Hufbilder hochkant 9:16 */
export const ASPECT_HOOF = 9 / 16
/** Ganzkörper Querformat 16:9 */
export const ASPECT_WHOLE = 16 / 9

/** Max Kantenlänge nach Verarbeitung (scharf, aber klein) */
export const MAX_DIMENSION_HOOF = 1080
export const MAX_DIMENSION_WHOLE = 1440
/** JPEG-Qualität (0–1) */
export const JPEG_QUALITY = 0.88
