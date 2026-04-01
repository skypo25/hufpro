'use client'

import { useEffect, useState } from 'react'

// Desktop-Layout mit Sidebar ist ab Tailwind `lg:` (1024px) gedacht.
// Für euren gewünschten Tablet-Übergang:
// Mobile-UI erst ab <960px, damit Tablet-Quer/hochformat Übergänge sauber bleiben.
const MOBILE_BREAKPOINT = 960

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < MOBILE_BREAKPOINT
  })

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    check()
    window.addEventListener('resize', check)
    return () => {
      window.removeEventListener('resize', check)
    }
  }, [])

  return isMobile
}
