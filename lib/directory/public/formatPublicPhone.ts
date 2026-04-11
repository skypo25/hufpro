import parsePhoneNumber from 'libphonenumber-js'

const DACH: readonly ('DE' | 'AT' | 'CH')[] = ['DE', 'AT', 'CH']

function defaultRegion(countryHint: string | null | undefined): 'DE' | 'AT' | 'CH' {
  return countryHint === 'AT' || countryHint === 'CH' || countryHint === 'DE' ? countryHint : 'DE'
}

function regionOrder(countryHint: string | null | undefined): ('DE' | 'AT' | 'CH')[] {
  const first = defaultRegion(countryHint)
  return [first, ...DACH.filter((r) => r !== first)]
}

/**
 * Anzeige im internationalen Format (z. B. +49 151 10000001).
 * Ungültige oder unbekannte Eingaben werden unverändert zurückgegeben.
 */
export function formatPublicPhoneForDisplay(raw: string, countryHint?: string | null): string {
  const s = raw.trim()
  if (!s) return ''

  for (const region of regionOrder(countryHint)) {
    const n = parsePhoneNumber(s, region)
    if (n?.isValid()) return n.formatInternational()
  }

  const n = parsePhoneNumber(s)
  if (n?.isValid()) return n.formatInternational()

  return s
}

/** `tel:`-URI; Fallback ohne Parser nur Leerzeichen entfernt. */
export function formatPublicPhoneTelHref(raw: string, countryHint?: string | null): string | null {
  const s = raw.trim()
  if (!s) return null

  for (const region of regionOrder(countryHint)) {
    const n = parsePhoneNumber(s, region)
    if (n?.isValid()) return n.getURI()
  }

  const n = parsePhoneNumber(s)
  if (n?.isValid()) return n.getURI()

  return `tel:${s.replace(/\s+/g, '').replace(/^tel:/i, '')}`
}
