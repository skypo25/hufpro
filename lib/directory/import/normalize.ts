import type { DirectoryImportRawRow, ServiceType } from './types'

export function trimToNull(s: string | null | undefined): string | null {
  if (s == null) return null
  const t = String(s).trim()
  return t.length === 0 ? null : t
}

export function upperCountry(s: string | null | undefined): string {
  const t = trimToNull(s)
  return (t ?? 'DE').toUpperCase()
}

const TRUTHY = new Set(['1', 'true', 'ja', 'yes', 'j', 'wahr', 'x'])

export function parseTruthy(s: string | null | undefined): boolean {
  const t = trimToNull(s)?.toLowerCase()
  if (!t) return false
  return TRUTHY.has(t)
}

export function mapServiceType(raw: string | null | undefined): ServiceType {
  const t = trimToNull(raw)?.toLowerCase() ?? ''
  if (!t) return 'both'
  if (/(^|\s)(beides|both|mobil.*praxis|praxis.*mobil)/.test(t)) return 'both'
  if (/\bstationary\b/.test(t)) return 'stationary'
  if (/\bmobil/.test(t) && !/\bpraxis\b/.test(t)) return 'mobile'
  if (/\bpraxis\b/.test(t) && !/\bmobil/.test(t)) return 'stationary'
  if (/\bmobil/.test(t)) return 'mobile'
  if (/\bpraxis|stationär|fest/.test(t)) return 'stationary'
  return 'both'
}

export function mapVerificationState(raw: string | boolean | null | undefined): 'none' | 'pending' | 'verified' | 'rejected' {
  if (raw === true) return 'verified'
  if (raw === false) return 'none'
  const t = trimToNull(raw as string | null | undefined)?.toLowerCase() ?? ''
  if (!t) return 'none'
  if (/verif|geprüft|bestätigt|^ja$/.test(t)) return 'verified'
  if (/abgelehnt|^nein$/.test(t)) return 'rejected'
  if (/^false$/.test(t)) return 'none'
  if (/pending|ausstehend|prüfung/.test(t)) return 'pending'
  return 'none'
}

export type ListingStatusImport = 'draft' | 'published'

/**
 * Roh „profil_status“ → listing_status. Konservativ: nur explizite Publish-Synonyme,
 * wenn allowPublished true ist.
 */
export function mapListingStatus(
  raw: string | null | undefined,
  allowPublished: boolean
): ListingStatusImport {
  if (!allowPublished) return 'draft'
  const t = trimToNull(raw)?.toLowerCase() ?? ''
  if (!t) return 'draft'
  if (/publish|veröffent|live|online|aktiv\s*list/.test(t)) return 'published'
  // Rohdaten: „unbeansprucht“ = sichtbar im Verzeichnis, Claim noch frei (nicht Entwurf).
  if (/unbeansprucht|unclaimed|frei|offen|sichtbar/.test(t)) return 'published'
  return 'draft'
}

export function mapSourceType(raw: string | null | undefined): string {
  const t = trimToNull(raw)?.toLowerCase() ?? ''
  if (!t) return 'manual_research'
  if (/csv|excel|sheet/.test(t)) return 'csv_import'
  if (/api/.test(t)) return 'api_import'
  if (/user|formular/.test(t)) return 'user_submission'
  return 'manual_research'
}

export function mapDataQuality(raw: string | null | undefined): 'raw' | 'reviewed' | 'verified' {
  const t = trimToNull(raw)?.toLowerCase() ?? ''
  if (!t) return 'raw'
  if (/verif|bestätigt|geprüft/.test(t)) return 'verified'
  if (/review|geprüft|redakt|sichtung|bereinigt/.test(t)) return 'reviewed'
  return 'raw'
}

export function normalizeWebsiteUrl(raw: string | null | undefined): string | null {
  const t = trimToNull(raw)
  if (!t) return null
  try {
    const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`
    const u = new URL(withProto)
    const host = u.hostname.toLowerCase()
    const path = u.pathname.replace(/\/$/, '') || ''
    return `${host}${path}`
  } catch {
    return t.toLowerCase()
  }
}

export function buildDescriptionParts(row: DirectoryImportRawRow): string | null {
  const parts: string[] = []
  const kurz = trimToNull(row.beschreibung_kurz)
  const qual = trimToNull(row.qualifikationen)
  const leis = trimToNull(row.leistungen)
  if (kurz) parts.push(kurz)
  if (qual) parts.push(`Qualifikationen:\n${qual}`)
  if (leis) parts.push(`Leistungen:\n${leis}`)
  if (parts.length === 0) return null
  return parts.join('\n\n')
}
