'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

function RouteFallback() {
  return (
    <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-2 px-6 text-[14px] text-[#6B7280]">
      <span className="inline-block h-4 w-4 animate-pulse rounded-full bg-[#E5E2DC]" aria-hidden />
      Laden…
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dyn = (importer: () => Promise<{ default: React.ComponentType<any> }>) =>
  dynamic(importer, { loading: () => <RouteFallback /> })

const MobilePlaceholder = dyn(() => import('./MobilePlaceholder'))
const MobileSearch = dyn(() => import('./MobileSearch'))
const MobileCalendar = dyn(() => import('./MobileCalendar'))
const MobileAppointmentDetail = dyn(() => import('./MobileAppointmentDetail'))
const MobileSettings = dyn(() => import('./MobileSettings'))
const MobileDashboard = dyn(() => import('./MobileDashboard'))
const MobileCustomers = dyn(() => import('./MobileCustomers'))
const MobileHorses = dyn(() => import('./MobileHorses'))
const MobileHorseDetail = dyn(() => import('./MobileHorseDetail'))
const MobileCustomerDetail = dyn(() => import('./MobileCustomerDetail'))
const MobileCustomerEdit = dyn(() => import('./MobileCustomerEdit'))
const MobileRecordEntry = dyn(() => import('./MobileRecordEntry'))
const MobileRecordDetail = dyn(() => import('./MobileRecordDetail'))
const MobileAnimalFormScreen = dyn(() => import('./MobileAnimalFormScreen'))
const MobileErstanamnese = dyn(() => import('./MobileErstanamnese'))
const MobileErstanamneseEdit = dyn(() => import('./MobileErstanamneseEdit'))
const MobileCustomerForm = dyn(() => import('./MobileCustomerForm'))
const MobileAppointmentForm = dyn(() => import('./MobileAppointmentForm'))
const MobileHoofCompare = dynamic(() => import('@/components/hoofCompare/MobileHoofCompare'), {
  loading: () => (
    <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-2 px-6 text-[14px] text-[#6B7280]">
      <i className="bi bi-hourglass-split text-[20px]" aria-hidden />
      Fotovergleich wird geladen…
    </div>
  ),
})
const MobileBilling = dyn(() => import('./MobileBilling'))

const compareFallback = (
  <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-2 px-6 text-[14px] text-[#6B7280]">
    <i className="bi bi-hourglass-split text-[20px]" aria-hidden />
    Fotovergleich wird geladen…
  </div>
)

/**
 * Pro Route nur das jeweilige Chunk laden (kein monolithischer Mobile-Bundle).
 * Registrierung neuer Mobile-Seiten: Bedingung unten ergänzen + dyn()-Zeile oben.
 */
function useMobileContent(): ReactNode {
  const pathname = usePathname()

  const compareMobileMatch = pathname?.match(/^\/animals\/([^/?#]+)\/records\/compare\/mobile\/?$/)
  if (compareMobileMatch?.[1]) {
    return (
      <Suspense fallback={compareFallback}>
        <MobileHoofCompare horseId={compareMobileMatch[1]} />
      </Suspense>
    )
  }

  const newRecordMatch = pathname?.match(/^\/animals\/([^/?#]+)\/records\/new$/)
  if (newRecordMatch?.[1]) {
    return <MobileRecordEntry horseId={newRecordMatch[1]} mode="create" />
  }

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

  const editCustomerMatch = pathname?.match(/^\/customers\/([^/?#]+)\/edit$/)
  if (editCustomerMatch?.[1]) {
    return <MobileCustomerEdit customerId={editCustomerMatch[1]} />
  }

  const customerIdMatch = pathname?.match(/^\/customers\/([^/?#]+)/)
  if (customerIdMatch?.[1]) {
    return <MobileCustomerDetail customerId={customerIdMatch[1]} />
  }

  if (pathname === '/appointments/new') {
    return <MobileAppointmentForm mode="create" />
  }

  const editAppointmentMatch = pathname?.match(/^\/appointments\/([^/?#]+)\/edit$/)
  if (editAppointmentMatch?.[1]) {
    return <MobileAppointmentForm mode="edit" appointmentId={editAppointmentMatch[1]} />
  }

  const appointmentIdMatch = pathname?.match(/^\/appointments\/([^/?#]+)\/?$/)
  if (appointmentIdMatch?.[1]) {
    return <MobileAppointmentDetail appointmentId={appointmentIdMatch[1]} />
  }

  if (pathname === '/dashboard') return <MobileDashboard />
  if (pathname === '/calendar') return <MobileCalendar />
  if (pathname === '/customers') return <MobileCustomers />
  if (pathname === '/animals') return <MobileHorses />

  if (pathname === '/invoices') return <MobilePlaceholder />
  if (pathname === '/billing') return <MobileBilling />
  if (pathname === '/settings') return <MobileSettings />
  if (pathname === '/suche') return <MobileSearch />

  return <MobilePlaceholder />
}

/** Nur in der Mobile-Branch mounten — spart Desktop die komplette Mobile-Route-Logik. */
export function MobileRouteContent(): ReactNode {
  return useMobileContent()
}
