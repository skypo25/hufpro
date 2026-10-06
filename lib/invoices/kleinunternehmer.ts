/** Gesetzlich üblicher Hinweis nach § 19 UStG (Kleinunternehmerregelung). */
export const KLEINUNTERNEHMER_PFLICHTSATZ =
  'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.'

export function resolveKleinunternehmerHinweis(
  isKleinunternehmer: boolean,
  customText?: string | null
): string | null {
  if (!isKleinunternehmer) return null
  const custom = (customText ?? '').trim()
  return custom || KLEINUNTERNEHMER_PFLICHTSATZ
}
