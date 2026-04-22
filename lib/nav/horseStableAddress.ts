/** Reine Hilfsfunktionen: Stall-/Nav-Adresse aus Pferd-Zeilen, Rechnungsadresse aus Kunde. */

export type HorseStallFields = {
  stable_name?: string | null
  stable_street?: string | null
  stable_zip?: string | null
  stable_city?: string | null
  stable_country?: string | null
  stable_contact?: string | null
  stable_phone?: string | null
  stable_directions?: string | null
}

export type CustomerBillingFields = {
  street?: string | null
  postal_code?: string | null
  city?: string | null
  country?: string | null
}

export function formatAddressLine(
  street: string | null | undefined,
  zip: string | null | undefined,
  city: string | null | undefined
): string {
  const zipCity = [zip, city].filter(Boolean).join(' ')
  const parts = [street?.trim(), zipCity].filter(Boolean) as string[]
  return parts.join(', ')
}

export function horseHasStructuredStall(h: HorseStallFields): boolean {
  return !!(h.stable_street?.trim() || h.stable_zip?.trim() || h.stable_city?.trim())
}

export function buildStallNavLineFromHorse(h: HorseStallFields): string | null {
  if (!horseHasStructuredStall(h)) return null
  return formatAddressLine(h.stable_street, h.stable_zip, h.stable_city) || null
}

export function buildBillingNavLineFromCustomer(c: CustomerBillingFields): string | null {
  const line = formatAddressLine(c.street, c.postal_code, c.city)
  return line.trim() ? line : null
}

/** Erstes Pferd mit Straße/PLZ/Ort, sonst erstes mit Stallnamen. */
export function pickPrimaryStallHorse<T extends HorseStallFields>(horses: T[]): T | null {
  if (!horses.length) return null
  const structured = horses.find(horseHasStructuredStall)
  if (structured) return structured
  const named = horses.find((h) => h.stable_name?.trim())
  return named ?? null
}

export function buildStallMultilineFromHorse(h: HorseStallFields): string {
  const lines: string[] = []
  if (h.stable_name?.trim()) lines.push(h.stable_name.trim())
  const streetPart = h.stable_street?.trim()
  const zipCity = [h.stable_zip?.trim(), h.stable_city?.trim()].filter(Boolean).join(' ')
  const addrLine = [streetPart, zipCity].filter(Boolean).join(', ')
  if (addrLine) lines.push(addrLine)
  if (h.stable_country?.trim() && h.stable_country.trim() !== 'Deutschland') {
    lines.push(h.stable_country.trim())
  }
  return lines.join('\n')
}

export function stallDisplayLabel(h: HorseStallFields, fallbackCity?: string | null): string {
  return (
    h.stable_name?.trim() ||
    h.stable_city?.trim() ||
    (fallbackCity?.trim() ?? '') ||
    ''
  )
}

/** Einzeiler nur aus Pferd-Stallfeldern (ohne Fallback auf Kundenort). Für Kunden-Detail & Listen. */
export function stallOverviewLine(h: HorseStallFields): string | null {
  const name = h.stable_name?.trim()
  const addr = formatAddressLine(h.stable_street, h.stable_zip, h.stable_city).trim()
  if (name && addr) return `${name} · ${addr}`
  if (name) return name
  if (addr) return addr
  return null
}
