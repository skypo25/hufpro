/**
 * Sichtbarkeit der mobilen Foto-Debug-Oberfläche.
 * - Development: immer erlaubt
 * - Production: nur wenn `NEXT_PUBLIC_MOBILE_DEBUG_EMAILS` die eingeloggte E-Mail enthält (Komma-getrennt, case-insensitive)
 */

export function canUseMobilePhotoDebugPanel(email: string | null | undefined): boolean {
  if (process.env.NODE_ENV === 'development') return true
  const raw = process.env.NEXT_PUBLIC_MOBILE_DEBUG_EMAILS?.trim()
  if (!raw || !email) return false
  const e = email.trim().toLowerCase()
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(e)
}
