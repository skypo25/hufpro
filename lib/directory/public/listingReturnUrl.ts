/** SessionStorage: letzte Verzeichnis-Listen-URL (`/behandler` + Query) für „Zurück zur Suche“. */
export const DIRECTORY_LISTING_RETURN_SESSION_KEY = 'directory:listingReturn:v1'

const INTERNAL_BASE = 'https://directory.invalid'

/**
 * Nur gleichartige relative Pfade erlauben (kein Open-Redirect).
 * Zulässig: `/behandler`, optional mit Query — kein zweites Pfadsegment (kein Profil-Slug).
 */
export function isSafeBehandlerListingReturnPath(raw: string): boolean {
  const t = raw.trim()
  if (!t.startsWith('/') || t.startsWith('//')) return false
  if (t.length > 8000) return false
  try {
    const u = new URL(t, INTERNAL_BASE)
    if (u.origin !== new URL(INTERNAL_BASE).origin) return false
    const pn = u.pathname.replace(/\/+$/, '') || '/'
    if (pn !== '/behandler') return false
    return true
  } catch {
    return false
  }
}

export function readBehandlerListingReturnPath(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const s = sessionStorage.getItem(DIRECTORY_LISTING_RETURN_SESSION_KEY)
    if (!s) return null
    return isSafeBehandlerListingReturnPath(s) ? s : null
  } catch {
    return null
  }
}

export function writeBehandlerListingReturnPath(pathWithOptionalQuery: string): void {
  if (typeof window === 'undefined') return
  if (!isSafeBehandlerListingReturnPath(pathWithOptionalQuery)) return
  try {
    sessionStorage.setItem(DIRECTORY_LISTING_RETURN_SESSION_KEY, pathWithOptionalQuery)
  } catch {
    /* ignore */
  }
}
