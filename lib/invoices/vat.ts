/** MwSt. aus den Betriebseinstellungen, wenn die Kleinunternehmerregelung aus ist. */

export function isKleinunternehmerSetting(value: unknown): boolean {
  if (value === false || value === 'false' || value === 0 || value === '0') return false
  if (value === true || value === 'true' || value === 1 || value === '1') return true
  return true
}

export function parseTaxRatePercent(value: unknown): number {
  const m = String(value ?? '').match(/(\d+(?:[.,]\d+)?)/)
  if (!m) return 19
  const n = parseFloat(m[1].replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return 19
  return n
}

export function vatFromSettings(settings: Record<string, unknown> | null | undefined): {
  kleinunternehmer: boolean
  taxRatePercent: number
} {
  const s = settings ?? {}
  const kleinunternehmer = isKleinunternehmerSetting(s.kleinunternehmer)
  return {
    kleinunternehmer,
    taxRatePercent: kleinunternehmer ? 0 : parseTaxRatePercent(s.defaultTaxRate),
  }
}

export function taxCentsOnNet(netCents: number, taxRatePercent: number): number {
  if (!taxRatePercent) return 0
  return Math.round(netCents * taxRatePercent / 100)
}

export function invoiceVatTotals(
  netCents: number,
  taxRatePercent: number
): { netCents: number; taxCents: number; grossCents: number; taxRatePercent: number } {
  const taxCents = taxCentsOnNet(netCents, taxRatePercent)
  return { netCents, taxCents, grossCents: netCents + taxCents, taxRatePercent }
}

export function effectiveLineTaxRate(
  storedRate: number,
  kleinunternehmer: boolean,
  defaultRate: number
): number {
  if (kleinunternehmer) return 0
  return storedRate > 0 ? storedRate : defaultRate
}

export function lineGrossCents(
  netCents: number,
  storedRate: number,
  kleinunternehmer: boolean,
  defaultRate: number
): number {
  const rate = effectiveLineTaxRate(storedRate, kleinunternehmer, defaultRate)
  return netCents + taxCentsOnNet(netCents, rate)
}

export function invoiceGrossCentsFromItems(
  items: Array<{ amount_cents?: number | null; tax_rate_percent?: number | null }>,
  kleinunternehmer: boolean,
  defaultRate: number
): number {
  return items.reduce(
    (sum, it) =>
      sum + lineGrossCents(it.amount_cents ?? 0, Number(it.tax_rate_percent) || 0, kleinunternehmer, defaultRate),
    0
  )
}
