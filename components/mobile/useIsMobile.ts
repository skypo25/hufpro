'use client'

import { useLayoutEffect, useState } from 'react'

import { ANIDOCS_SHELL_COOKIE } from '@/lib/mobile/shellPreference'

// Desktop-Layout mit Sidebar ist ab Tailwind `lg:` (1024px) gedacht.
// Für euren gewünschten Tablet-Übergang:
// Mobile-UI erst ab <960px, damit Tablet-Quer/hochformat Übergänge sauber bleiben.
const MOBILE_BREAKPOINT = 960

function syncShellCookie(isMobile: boolean) {
  const value = isMobile ? 'mobile' : 'desktop'
  // Path=/ damit Server-Pages (Record-Detail) die Shell lesen und schwere SSR skippen können.
  document.cookie = `${ANIDOCS_SHELL_COOKIE}=${value}; path=/; max-age=31536000; SameSite=Lax`
}

/**
 * Ob die schmale Mobile-Shell genutzt werden soll.
 * Erster Render ist immer `false` (SSR + Hydration), damit Server-HTML und Client
 * übereinstimmen — Breite wird erst nach Mount per `useLayoutEffect` gesetzt (minimaler Flash).
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useLayoutEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT
      setIsMobile(mobile)
      syncShellCookie(mobile)
    }
    check()
    window.addEventListener('resize', check)
    return () => {
      window.removeEventListener('resize', check)
    }
  }, [])

  return isMobile
}
