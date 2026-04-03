/** Sinnvoller Standard: genug Zeit zum Download, kein Dauer-Archiv (Speicher). */
export const DEFAULT_DATA_EXPORT_RETENTION_DAYS = 14

/** Mindestens 1 Tag, maximal 365 — ungültige Werte → Standard. */
export function coerceDataExportRetentionDays(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_DATA_EXPORT_RETENTION_DAYS
  return Math.min(365, Math.max(1, Math.floor(n)))
}

/** Fallback, wenn `system_settings` nicht greift (lokal / Migration fehlt). */
export function getDataExportRetentionDaysFromEnv(): number {
  const raw = process.env.DATA_EXPORT_RETENTION_DAYS?.trim()
  if (!raw) return DEFAULT_DATA_EXPORT_RETENTION_DAYS
  return coerceDataExportRetentionDays(Number(raw))
}
