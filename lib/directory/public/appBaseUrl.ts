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

/** Relativer Pfad zum Onboarding-Wizard (gleiche Next-Site wie /behandler). */
export const DIRECTORY_PROFILE_CREATE_PATH = '/behandler/profil/erstellen' as const

export function directoryProfileCreateHref(): string {
  return DIRECTORY_PROFILE_CREATE_PATH
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
