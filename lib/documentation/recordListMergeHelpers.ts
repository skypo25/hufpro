/**
 * Gemeinsame Hilfen für Record-Listen (Pferdedetail, Kundenliste):
 * Legacy-ID aus metadata, Datumsableitung, Sortierschlüssel.
 */

export function parseLegacyHoofRecordId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null
  const v = (metadata as { legacy_hoof_record_id?: unknown }).legacy_hoof_record_id
  return typeof v === 'string' && v.length > 0 ? v : null
}

export function dayFromSession(sessionDate: string | null | undefined): string | null {
  if (!sessionDate) return null
  return sessionDate.slice(0, 10)
}

export function mergeSortTime(recordDate: string | null, createdAt: string | null): number {
  if (recordDate) {
    const t = Date.parse(recordDate)
    if (!Number.isNaN(t)) return t
  }
  if (createdAt) {
    const t = Date.parse(createdAt)
    if (!Number.isNaN(t)) return t
  }
  return 0
}
