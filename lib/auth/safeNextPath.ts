/**
 * Relativer Pfad nach Login/OAuth. Verhindert open redirects (keine //, keine externen URLs).
 */
export function safeInternalPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null
  return raw
}

export function safeNextPath(raw: string | null, fallback = '/dashboard'): string {
  return safeInternalPath(raw) ?? fallback
}

/** Client-only: falls der E-Mail-Bestätigungslink kein `?next=` mehr trägt (Redirect-URL-Limits, Mail-Client). */
export const AUTH_RETURN_SESSION_KEY = 'anidocs_auth_return' as const

/** Client-only: Paketwahl für Rückkehr nach fehlgeschlagenem Auth-Callback (ohne App-Routen). */
export const DIRECTORY_WIZARD_PAKET_SESSION_KEY = 'anidocs_wizard_paket' as const
