'use client'

import { usePathname } from 'next/navigation'
import { CookieConsentLayer } from '@/components/consent/CookieConsentLayer'

function isPublicScopePath(pathname: string): boolean {
  // Public / marketing / directory pages where we want the cookie layer.
  // Everything else is considered "App" scope and should not show the cookie UI.
  if (pathname === '/') return true

  const prefixes = [
    '/behandler',
    '/agb',
    '/datenschutz',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/termin-bestaetigen',
  ]
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function CookieConsentLayerGate() {
  const pathname = usePathname() || '/'
  if (!isPublicScopePath(pathname)) return null
  return <CookieConsentLayer />
}

