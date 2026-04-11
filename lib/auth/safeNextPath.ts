/**
 * Relativer Pfad nach Login/OAuth. Verhindert open redirects (keine //, keine externen URLs).
 */
export function safeNextPath(raw: string | null, fallback = '/dashboard'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return fallback
  return raw
}
