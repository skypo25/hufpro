/**
 * Kurztitel für Listing & SEO: Personen-/Berufsbezeichnung statt Fachbezeichnung
 * (z. B. „Tierheilpraktiker“ statt „Tierheilpraktik“).
 */
const SPECIALTY_HEADLINE_BY_CODE: Record<string, string> = {
  tierphysiotherapie: 'Tierphysiotherapeut',
  tierosteopathie: 'Tierosteopath',
  tierheilpraktik: 'Tierheilpraktiker',
  hufbearbeitung: 'Hufbearbeiter',
  barhufbearbeitung: 'Barhufbearbeiter',
  hufschmied: 'Hufschmied',
  pferdedentist: 'Pferdedentist',
}

export function listingSpecialtyHeadline(code: string, officialName: string): string {
  return SPECIALTY_HEADLINE_BY_CODE[code] ?? officialName
}
