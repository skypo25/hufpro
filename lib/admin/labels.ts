import { deriveAppProfile, type Profession } from '@/lib/appProfile'

const PROFESSION_LABELS: Record<Profession, string> = {
  hufbearbeiter: 'Hufbearbeiter',
  tierheilpraktiker: 'Tierheilpraktiker',
  tierphysiotherapeut: 'Physiotherapeut',
  osteopath: 'Osteopath',
  sonstiges: 'Sonstiges',
}

export function professionLabelFromSettings(
  settings: Record<string, unknown> | null | undefined
): string {
  if (!settings) return '—'
  const profile = deriveAppProfile(settings.profession, settings.animal_focus)
  return PROFESSION_LABELS[profile.profession] ?? '—'
}

export function displayNameFromAuth(
  email: string | null | undefined,
  meta: { first_name?: string; last_name?: string; full_name?: string } | undefined,
  settings: Record<string, unknown> | null | undefined
): string {
  const s = settings as { firstName?: string; lastName?: string } | undefined
  const first = (s?.firstName ?? meta?.first_name ?? '').toString().trim()
  const last = (s?.lastName ?? meta?.last_name ?? '').toString().trim()
  const combined = [first, last].filter(Boolean).join(' ')
  if (combined) return combined
  const full = (meta?.full_name ?? '').toString().trim()
  if (full) return full
  return email?.split('@')[0] ?? 'Nutzer'
}
