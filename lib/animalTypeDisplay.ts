import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
  faCat,
  faDog,
  faHorse,
  faPaw,
  faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons'

/** Farbe für Tierarten-Icons (Kundenkarte, Listen) */
export const animalTypeIconColor = '#154226'

/** Font-Awesome-Icon passend zu `horses.animal_type` (leer/unbekannt = Pferd). */
export function faIconForAnimalType(animalType: string | null | undefined): IconDefinition {
  const t = (animalType ?? '').trim().toLowerCase()
  if (t === 'dog') return faDog
  if (t === 'cat') return faCat
  if (t === 'small') return faPaw
  if (t === 'other') return faWandMagicSparkles
  return faHorse
}

/** Pill-Badge für Tierart (helles Mint, dunkelgrün) — Liste & mobil */
export const animalTypeBadgeClassName =
  'inline-flex max-w-full items-center justify-center rounded-full bg-[#edf3ef] px-3 py-1 text-[12px] font-semibold leading-tight text-[#154226]'

/** Anzeige für `horses.neutered` (yes/no/unknown oder Legacy-Text) */
export function formatNeuteredLabel(raw: string | null | undefined): string {
  if (raw == null) return '–'
  const v = raw.trim().toLowerCase()
  if (v === '') return '–'
  if (v === 'yes' || v === 'ja' || v === 'true') return 'Ja'
  if (v === 'no' || v === 'nein' || v === 'false') return 'Nein'
  if (v === 'unknown' || v === 'unbekannt') return 'Unbekannt'
  return raw.trim()
}

/** Gewicht in kg für DE-Anzeige */
export function formatWeightKgKg(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '–'
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  if (!Number.isFinite(n)) return '–'
  return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(n)} kg`
}

/** Anzeigename für `horses.animal_type` (horse/dog/cat/small/other); leer = Pferd */
export function formatAnimalTypeLabel(animalType: string | null | undefined): string {
  const t = (animalType ?? '').trim().toLowerCase()
  if (!t || t === 'horse') return 'Pferd'
  if (t === 'dog') return 'Hund'
  if (t === 'cat') return 'Katze'
  if (t === 'small') return 'Kleintier'
  if (t === 'other') return 'Sonstiges'
  return t
}

export type AnimalTypeKey = 'horse' | 'dog' | 'cat' | 'small' | 'other'

/** Normalisiert DB-Wert zu einer der bekannten Tierarten (leer/unbekannt → Pferd). */
export function normalizeAnimalTypeKey(animalType: string | null | undefined): AnimalTypeKey {
  const t = (animalType ?? '').trim().toLowerCase()
  if (t === 'dog') return 'dog'
  if (t === 'cat') return 'cat'
  if (t === 'small') return 'small'
  if (t === 'other') return 'other'
  return 'horse'
}

const ANIMAL_TYPE_COUNT_LABELS: Record<AnimalTypeKey, readonly [string, string]> = {
  horse: ['Pferd', 'Pferde'],
  dog: ['Hund', 'Hunde'],
  cat: ['Katze', 'Katzen'],
  small: ['Kleintier', 'Kleintiere'],
  other: ['Sonstiges Tier', 'Sonstige Tiere'],
}

function formatCountForSingleAnimalType(count: number, key: AnimalTypeKey): string {
  const [one, many] = ANIMAL_TYPE_COUNT_LABELS[key]
  if (count === 1) return `1 ${one}`
  return `${count} ${many}`
}

/**
 * Kurztext für die Kundenliste: eine Art → „1 Katze“ / „2 Pferde“; mehrere Arten → „4 Tiere“.
 * Keine Tiere → „Keine Tiere“.
 */
export function formatCustomerAnimalsSummary(
  animals: ReadonlyArray<{ animal_type?: string | null }>
): string {
  const n = animals.length
  if (n === 0) return 'Keine Tiere'
  const byKey = new Map<AnimalTypeKey, number>()
  for (const a of animals) {
    const k = normalizeAnimalTypeKey(a.animal_type)
    byKey.set(k, (byKey.get(k) || 0) + 1)
  }
  const nonEmpty = [...byKey.entries()].filter(([, c]) => c > 0)
  if (nonEmpty.length === 1) {
    const [key, count] = nonEmpty[0]!
    return formatCountForSingleAnimalType(count, key)
  }
  return `${n} Tiere`
}

/** Wenn nur die Anzahl bekannt ist (z. B. nächster Termin): „1 Tier“ / „3 Tiere“. */
export function formatGenericAnimalCount(count: number): string {
  if (count <= 0) return ''
  if (count === 1) return '1 Tier'
  return `${count} Tiere`
}

/** Für Terminzeilen: „2 Pferde bearbeitet“ / „4 Tiere bearbeitet“; leer wenn keine Tiere. */
export function formatAnimalsWorkedSummary(
  animals: ReadonlyArray<{ animal_type?: string | null }>
): string {
  if (animals.length === 0) return ''
  return `${formatCustomerAnimalsSummary(animals)} bearbeitet`
}
