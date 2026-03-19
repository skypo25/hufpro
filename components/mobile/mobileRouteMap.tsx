'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import MobilePlaceholder from './MobilePlaceholder'
import MobileDashboard from './MobileDashboard'
import MobileCustomers from './MobileCustomers'
import MobileHorses from './MobileHorses'
import MobileHorseDetail from './MobileHorseDetail'
import MobileCustomerDetail from './MobileCustomerDetail'
import MobileRecordForm from './MobileRecordForm'
import MobileRecordDetail from './MobileRecordDetail'

/**
 * Hier werden die Mobile-Seiten pro Route eingetragen.
 * Route für Route wird mit dem gelieferten Layout ergänzt.
 */
export function useMobileContent(): ReactNode {
  const pathname = usePathname()

  // Neue Dokumentation erstellen: /horses/[id]/records/new
  const newRecordMatch = pathname?.match(/^\/horses\/([^/?#]+)\/records\/new$/)
  if (newRecordMatch?.[1]) {
    return <MobileRecordForm horseId={newRecordMatch[1]} mode="create" />
  }

  // Dokumentation bearbeiten: /horses/[id]/records/[recordId]/edit
  const editRecordMatch = pathname?.match(/^\/horses\/([^/?#]+)\/records\/([^/?#]+)\/edit$/)
  if (editRecordMatch?.[1] && editRecordMatch?.[2]) {
    return <MobileRecordForm horseId={editRecordMatch[1]} recordId={editRecordMatch[2]} mode="edit" />
  }

  // Dokumentation Detail: /horses/[id]/records/[recordId]
  const recordDetailMatch = pathname?.match(/^\/horses\/([^/?#]+)\/records\/([^/?#]+)$/)
  if (recordDetailMatch?.[1] && recordDetailMatch?.[2]) {
    return <MobileRecordDetail horseId={recordDetailMatch[1]} recordId={recordDetailMatch[2]} />
  }

  const horseIdMatch = pathname?.match(/^\/horses\/([^/?#]+)/)
  if (horseIdMatch?.[1]) {
    return <MobileHorseDetail horseId={horseIdMatch[1]} />
  }

  const customerIdMatch = pathname?.match(/^\/customers\/([^/?#]+)/)
  if (customerIdMatch?.[1]) {
    return <MobileCustomerDetail customerId={customerIdMatch[1]} />
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
