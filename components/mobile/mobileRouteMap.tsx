'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import MobilePlaceholder from './MobilePlaceholder'
import MobileSearch from './MobileSearch'
import MobileCalendar from './MobileCalendar'
import MobileAppointmentDetail from './MobileAppointmentDetail'
import MobileSettings from './MobileSettings'
import MobileDashboard from './MobileDashboard'
import MobileCustomers from './MobileCustomers'
import MobileHorses from './MobileHorses'
import MobileHorseDetail from './MobileHorseDetail'
import MobileCustomerDetail from './MobileCustomerDetail'
import MobileCustomerEdit from './MobileCustomerEdit'
import MobileRecordEntry from './MobileRecordEntry'
import MobileRecordDetail from './MobileRecordDetail'
import MobileAnimalFormScreen from './MobileAnimalFormScreen'
import MobileErstanamnese from './MobileErstanamnese'
import MobileErstanamneseEdit from './MobileErstanamneseEdit'
import MobileCustomerForm from './MobileCustomerForm'
import MobileAppointmentForm from './MobileAppointmentForm'

/**
 * Hier werden die Mobile-Seiten pro Route eingetragen.
 * Route für Route wird mit dem gelieferten Layout ergänzt.
 */
export function useMobileContent(): ReactNode {
  const pathname = usePathname()

  // Neue Dokumentation erstellen: /animals/[id]/records/new
  const newRecordMatch = pathname?.match(/^\/animals\/([^/?#]+)\/records\/new$/)
  if (newRecordMatch?.[1]) {
    return <MobileRecordEntry horseId={newRecordMatch[1]} mode="create" />
  }

  // Dokumentation bearbeiten: /animals/[id]/records/[recordId]/edit
  const editRecordMatch = pathname?.match(/^\/animals\/([^/?#]+)\/records\/([^/?#]+)\/edit$/)
  if (editRecordMatch?.[1] && editRecordMatch?.[2]) {
    return (
      <MobileRecordEntry
        horseId={editRecordMatch[1]}
        recordId={editRecordMatch[2]}
        mode="edit"
      />
    )
  }

  // Dokumentation Detail: /animals/[id]/records/[recordId] (optional trailing slash)
  const recordDetailMatch = pathname?.match(/^\/animals\/([^/?#]+)\/records\/([^/?#]+)\/?$/)
  if (recordDetailMatch?.[1] && recordDetailMatch?.[2]) {
    return <MobileRecordDetail horseId={recordDetailMatch[1]} recordId={recordDetailMatch[2]} />
  }

  if (pathname === '/animals/new') {
    return <MobileAnimalFormScreen mode="create" />
  }

  const editAnimalMatch = pathname?.match(/^\/animals\/([^/?#]+)\/edit$/)
  if (editAnimalMatch?.[1]) {
    return <MobileAnimalFormScreen mode="edit" horseId={editAnimalMatch[1]} />
  }

  const erstanamneseEditMatch = pathname?.match(/^\/animals\/([^/?#]+)\/erstanamnese\/edit\/?$/)
  if (erstanamneseEditMatch?.[1]) {
    return <MobileErstanamneseEdit horseId={erstanamneseEditMatch[1]} />
  }

  const erstanamneseMatch = pathname?.match(/^\/animals\/([^/?#]+)\/erstanamnese\/?$/)
  if (erstanamneseMatch?.[1]) {
    return <MobileErstanamnese horseId={erstanamneseMatch[1]} />
  }

  const horseIdMatch = pathname?.match(/^\/animals\/([^/?#]+)/)
  if (horseIdMatch?.[1]) {
    return <MobileHorseDetail horseId={horseIdMatch[1]} />
  }

  if (pathname === '/customers/new') {
    return <MobileCustomerForm />
  }

  // Kunden bearbeiten: /customers/[id]/edit
  const editCustomerMatch = pathname?.match(/^\/customers\/([^/?#]+)\/edit$/)
  if (editCustomerMatch?.[1]) {
    return <MobileCustomerEdit customerId={editCustomerMatch[1]} />
  }

  const customerIdMatch = pathname?.match(/^\/customers\/([^/?#]+)/)
  if (customerIdMatch?.[1]) {
    return <MobileCustomerDetail customerId={customerIdMatch[1]} />
  }

  // Termin anlegen: /appointments/new
  if (pathname === '/appointments/new') {
    return <MobileAppointmentForm mode="create" />
  }

  // Termin bearbeiten: /appointments/[id]/edit
  const editAppointmentMatch = pathname?.match(/^\/appointments\/([^/?#]+)\/edit$/)
  if (editAppointmentMatch?.[1]) {
    return <MobileAppointmentForm mode="edit" appointmentId={editAppointmentMatch[1]} />
  }

  // Termin-Detail: /appointments/[id]
  const appointmentIdMatch = pathname?.match(/^\/appointments\/([^/?#]+)\/?$/)
  if (appointmentIdMatch?.[1]) {
    return <MobileAppointmentDetail appointmentId={appointmentIdMatch[1]} />
  }

  if (pathname === '/dashboard') return <MobileDashboard />
  if (pathname === '/calendar') return <MobileCalendar />
  if (pathname === '/customers') return <MobileCustomers />
  if (pathname === '/animals') return <MobileHorses />

  if (pathname === '/invoices') return <MobilePlaceholder />
  if (pathname === '/settings') return <MobileSettings />
  if (pathname === '/suche') return <MobileSearch />

  return <MobilePlaceholder />
}

/**
 * Neue Mobile-Seite registrieren:
 * -> Bedingung oben in useMobileContent ergänzen.
 */
export {}
