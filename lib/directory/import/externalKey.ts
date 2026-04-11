import { normalizeWebsiteUrl, trimToNull } from './normalize'

/**
 * Stabiler Schlüssel für Dubletten / Re-Import (directory_profile_sources.external_key).
 */
export function buildExternalKey(params: {
  website?: string | null
  praxisname?: string | null
  plz?: string | null
  telefon?: string | null
}): string {
  const site = normalizeWebsiteUrl(params.website)
  if (site) return `web:${site}`

  const name = trimToNull(params.praxisname)?.toLowerCase().replace(/\s+/g, ' ') ?? ''
  const plz = trimToNull(params.plz)?.replace(/\s/g, '') ?? ''
  if (name && plz) return `nameplz:${name}|${plz}`

  const tel = trimToNull(params.telefon)?.replace(/[^\d+]/g, '') ?? ''
  if (tel.length >= 8) return `tel:${tel}`

  return `fallback:${name || 'unknown'}|${plz}|${tel}`
}
