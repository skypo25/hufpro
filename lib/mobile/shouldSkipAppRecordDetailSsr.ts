import { cookies, headers } from 'next/headers'
import { userAgent } from 'next/server'

import { ANIDOCS_SHELL_COOKIE, parseAnidocsShellCookie } from '@/lib/mobile/shellPreference'

/**
 * Mobile-Shell rendert `{children}` nicht (`AppLayoutClient` → `MobileAppBranch`).
 * Schwere Record-Detail-SSR (inkl. Signed URLs) wäre dort verschwendet.
 */
export async function shouldSkipAppRecordDetailSsr(): Promise<boolean> {
  const jar = await cookies()
  const shell = parseAnidocsShellCookie(jar.get(ANIDOCS_SHELL_COOKIE)?.value)
  if (shell === 'mobile') return true
  if (shell === 'desktop') return false

  // Erster Besuch ohne Cookie: UA-Heuristik (typische PWA-Handys)
  const ua = userAgent({ headers: await headers() })
  return ua.device.type === 'mobile'
}
