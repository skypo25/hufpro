import { ANIMAL_ALIASES, SPECIALTY_ALIASES, SUBCATEGORY_ALIASES } from './aliases'
import { trimToNull } from './normalize'

function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Liefert Specialty-Codes (eindeutig): Hauptfach + optional Unterkategorie.
 */
export function resolveSpecialtyCodes(
  fachrichtung: string | null | undefined,
  unterkategorie: string | null | undefined
): string[] {
  const mainRaw = trimToNull(fachrichtung)
  const subRaw = trimToNull(unterkategorie)
  const codes = new Set<string>()

  if (mainRaw) {
    const k = normalizeKey(mainRaw)
    const code = SPECIALTY_ALIASES[k] ?? SPECIALTY_ALIASES[k.replace(/[\/]/g, ' ')] ?? null
    if (code) codes.add(code)
    else {
      const compact = k.replace(/[^a-zäöüß0-9]/gi, '')
      const fuzzy = SPECIALTY_ALIASES[compact]
      if (fuzzy) codes.add(fuzzy)
    }
  }

  if (subRaw) {
    const sk = normalizeKey(subRaw)
    const subCode = SUBCATEGORY_ALIASES[sk] ?? SUBCATEGORY_ALIASES[sk.replace(/\s+/g, '')]
    if (subCode) codes.add(subCode)
  }

  return Array.from(codes)
}

/**
 * Tierarten aus kommagetrenntem String → Codes.
 */
export function resolveAnimalTypeCodes(tierarten: string | null | undefined): string[] {
  const raw = trimToNull(tierarten)
  if (!raw) return []
  const parts = raw.split(/[,;/|]+/).map((p) => normalizeKey(p)).filter(Boolean)
  const codes = new Set<string>()
  for (const p of parts) {
    const code = ANIMAL_ALIASES[p] ?? ANIMAL_ALIASES[p.replace(/e$/, '')]
    if (code) codes.add(code)
  }
  return Array.from(codes)
}
