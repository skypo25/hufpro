/**
 * ISO 3166-1 alpha-2 → Regional-Indicator-Flaggen-Emoji (z. B. DE → 🇩🇪).
 * Leerer String, wenn kein gültiges 2-Buchstaben-A-Z-Format.
 */
export function flagEmojiFromIso3166Alpha2(code: string): string {
  const cc = code.trim().toUpperCase()
  if (cc.length !== 2 || !/^[A-Z]{2}$/.test(cc)) return ''
  return String.fromCodePoint(
    0x1f1e6 + (cc.charCodeAt(0) - 0x41),
    0x1f1e6 + (cc.charCodeAt(1) - 0x41),
  )
}

export type DachIso = 'DE' | 'AT' | 'CH'

/** Werte wie in DB / bestehenden Formularen (Ländername). */
export const DACH_FORM_COUNTRIES: readonly { iso: DachIso; value: string }[] = [
  { iso: 'DE', value: 'Deutschland' },
  { iso: 'AT', value: 'Österreich' },
  { iso: 'CH', value: 'Schweiz' },
] as const

export function dachLandSelectLabel(iso: DachIso, landName: string): string {
  const f = flagEmojiFromIso3166Alpha2(iso)
  return f ? `${f} ${landName}` : landName
}
