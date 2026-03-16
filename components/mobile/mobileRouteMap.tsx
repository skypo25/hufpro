'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import MobilePlaceholder from './MobilePlaceholder'
import MobileDashboard from './MobileDashboard'
import MobileCustomers from './MobileCustomers'
import MobileHorses from './MobileHorses'
import MobileHorseDetail from './MobileHorseDetail'

/**
 * Hier werden die Mobile-Seiten pro Route eingetragen.
 * Route für Route wird mit dem gelieferten Layout ergänzt.
 */
export function useMobileContent(): ReactNode {
  const pathname = usePathname()

  const horseIdMatch = pathname?.match(/^\/horses\/([^/?#]+)/)
  if (horseIdMatch?.[1]) {
    return <MobileHorseDetail horseId={horseIdMatch[1]} />
  }

  if (pathname === '/dashboard') return <MobileDashboard />
  if (pathname === '/calendar') return <MobilePlaceholder />
  if (pathname === '/customers') return <MobileCustomers />
  if (pathname === '/horses') return <MobileHorses />

  if (pathname === '/invoices') return <MobilePlaceholder />
  if (pathname === '/settings') return <MobilePlaceholder />
  if (pathname === '/suche') return <MobilePlaceholder />

  return <MobilePlaceholder />
}

/**
 * Neue Mobile-Seite registrieren:
 * -> Bedingung oben in useMobileContent ergänzen.
 */
export {}
