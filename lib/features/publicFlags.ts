/**
 * App-weite öffentliche Feature-Flags (kein Per-User-Admin-Flag).
 * Verzeichnis: Code/Daten bleiben; Flag steuert Sichtbarkeit.
 *
 * Aktivieren später: DIRECTORY_PUBLIC_ENABLED=true (oder NEXT_PUBLIC_… für Client).
 */

function envTruthy(name: string): boolean {
  const v = process.env[name]
  if (v == null || v === '') return false
  return /^(1|true|yes|on)$/i.test(v.trim())
}

/** Öffentliches Behandlerverzeichnis + Profile. Default: aus. */
export function isDirectoryPublicEnabled(): boolean {
  return (
    envTruthy('DIRECTORY_PUBLIC_ENABLED') ||
    envTruthy('NEXT_PUBLIC_DIRECTORY_PUBLIC_ENABLED')
  )
}
