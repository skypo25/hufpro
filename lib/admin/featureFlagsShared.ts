export const ADMIN_FEATURE_FLAG_KEYS = [
  'ai_assistant',
  'photo_compare',
  'invoices',
  'beta',
] as const

export type AdminFeatureFlagKey = (typeof ADMIN_FEATURE_FLAG_KEYS)[number]

export type UserFeatureFlags = Partial<Record<AdminFeatureFlagKey, boolean>>

/** Kernfunktionen: an, solange nicht explizit false. Beta: nur bei true. */
export function isFeatureEnabled(
  flags: UserFeatureFlags | Record<string, unknown> | null | undefined,
  key: AdminFeatureFlagKey
): boolean {
  const raw = flags?.[key]
  if (key === 'beta') return raw === true
  return raw !== false
}
