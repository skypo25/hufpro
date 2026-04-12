import { DIRECTORY_WIZARD_PAKET_SESSION_KEY } from '@/lib/auth/safeNextPath'

/** Öffentliche Site für /behandler (Share, kanonische URLs). Fallback: App-URL. */
export function directoryPublicSiteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_DIRECTORY_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!raw) return 'https://anidocs.de'
  return raw.startsWith('http') ? raw.replace(/\/+$/, '') : `https://${raw.replace(/\/+$/, '')}`
}

export function directoryPublicProfileAbsoluteUrl(slug: string): string {
  return `${directoryPublicSiteOrigin()}/behandler/${slug}`
}

/** Basis-URL der App (Links Register, Hilfe, …). */
export function directoryAppBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!raw) return 'https://app.anidocs.de'
  return raw.startsWith('http') ? raw.replace(/\/+$/, '') : `https://${raw.replace(/\/+$/, '')}`
}

/** Vorgeschaltete Paketwahl („Profil erstellen“-Einstieg). */
export const DIRECTORY_PACKAGE_CHOOSE_PATH = '/behandler/paket-waehlen' as const

/** Relativer Pfad zum Profil-Wizard (nur nach Login / bestätigtem Zugang). */
export const DIRECTORY_PROFILE_WIZARD_PATH = '/behandler/profil/erstellen' as const

/** Kompakter Verzeichnis-Einstieg vor dem Wizard (Gratis & Premium). */
export const DIRECTORY_PROFILE_REGISTER_PATH = '/behandler/profil/registrieren' as const

/** Öffentlicher Einstieg: zuerst Paket wählen (Conversion, klare Trennung vom Formular). */
export function directoryProfileCreateHref(): string {
  return DIRECTORY_PACKAGE_CHOOSE_PATH
}

export function directoryProfileWizardHref(query?: { paket: 'gratis' | 'premium' }): string {
  if (query?.paket) {
    return `${DIRECTORY_PROFILE_WIZARD_PATH}?paket=${query.paket}`
  }
  return DIRECTORY_PROFILE_WIZARD_PATH
}

/** Paketwahl → kompakte Registrierung (vor E-Mail-Bestätigung / Login). */
export function directoryProfileRegisterHref(query: { paket: 'gratis' | 'premium' }): string {
  return `${DIRECTORY_PROFILE_REGISTER_PATH}?paket=${query.paket}`
}

/** Wizard oder Verzeichnis-Registrierung — für Auth-Rückleitungen ohne Open-Redirect. */
export function isDirectoryBehandlerProfilFlowReturnPath(raw: string | null | undefined): boolean {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) return false
  const pathOnly = raw.split('?')[0]?.trim() ?? ''
  return pathOnly === DIRECTORY_PROFILE_WIZARD_PATH || pathOnly === DIRECTORY_PROFILE_REGISTER_PATH
}

/**
 * Client-only: Wizard-Ziel aus Session, falls `next` in der URL fehlt (z. B. E-Mail-Link ohne Query).
 */
export function clientDirectoryWizardHrefFromPaketSession(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const pk = window.sessionStorage.getItem(DIRECTORY_WIZARD_PAKET_SESSION_KEY)
    if (pk === 'premium' || pk === 'gratis') {
      return directoryProfileWizardHref({ paket: pk })
    }
  } catch {
    /* ignore */
  }
  return null
}

/** In Auth-Metadaten bei Verzeichnis-Registrierung (E-Mail-Link / neues Gerät ohne SessionStorage). */
export const DIRECTORY_PUBLIC_PAKET_USER_META_KEY = 'directory_public_paket' as const

export function directoryPublicPaketFromUserMetadata(
  user: { user_metadata?: Record<string, unknown> } | null | undefined
): 'gratis' | 'premium' | null {
  const p = user?.user_metadata?.[DIRECTORY_PUBLIC_PAKET_USER_META_KEY]
  return p === 'premium' ? 'premium' : p === 'gratis' ? 'gratis' : null
}

/**
 * Kurzer Query-Name für `emailRedirectTo` / OAuth: viele Supabase-„Redirect URLs“ matchen nur
 * `/auth/callback` ohne langes `?next=…` — Mail-Clients kürzen lange Links sonst auch.
 */
export const DIRECTORY_EMAIL_REDIRECT_PARAM = 'vz' as const

export function directoryPaketFromEmailRedirectParam(
  raw: string | null | undefined
): 'gratis' | 'premium' | null {
  const v = raw?.trim().toLowerCase()
  return v === 'premium' ? 'premium' : v === 'gratis' ? 'gratis' : null
}

/** E-Mail-Bestätigung & OAuth: möglichst kurze Callback-URL für die Supabase-Allowlist. */
export function directoryAuthEmailRedirectUrl(origin: string, paket: 'gratis' | 'premium'): string {
  const base = origin.replace(/\/+$/, '')
  return `${base}/auth/callback?${DIRECTORY_EMAIL_REDIRECT_PARAM}=${paket}`
}

export function directoryRegisterUrl(): string {
  return `${directoryAppBaseUrl()}/register`
}

/** „Über uns“ (Marketing). Optional: `NEXT_PUBLIC_ABOUT_URL` (vollständige URL). Sonst Hilfe in der App. */
export function directoryAboutUrl(): string {
  const raw = process.env.NEXT_PUBLIC_ABOUT_URL?.trim()
  if (raw) return raw.startsWith('http') ? raw.replace(/\/+$/, '') : `https://${raw.replace(/\/+$/, '')}`
  return `${directoryAppBaseUrl()}/hilfe`
}
