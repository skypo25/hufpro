'use client'

import { useLayoutEffect, useState } from 'react'

// Desktop-Layout mit Sidebar ist ab Tailwind `lg:` (1024px) gedacht.
// Für euren gewünschten Tablet-Übergang:
// Mobile-UI erst ab <960px, damit Tablet-Quer/hochformat Übergänge sauber bleiben.
const MOBILE_BREAKPOINT = 960

/**
 * Ob die schmale Mobile-Shell genutzt werden soll.
 * Erster Render ist immer `false` (SSR + Hydration), damit Server-HTML und Client
 * übereinstimmen — Breite wird erst nach Mount per `useLayoutEffect` gesetzt (minimaler Flash).
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useLayoutEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    check()
    window.addEventListener('resize', check)
    return () => {
      window.removeEventListener('resize', check)
    }
  }, [])

  return isMobile
}
