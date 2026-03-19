'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { formatCustomerNumber } from '@/lib/format'

type Customer = {
  id: string
  customerNumber: number | null
  name: string | null
  firstName: string | null
  lastName: string | null
  phone: string | null
  email: string | null
  street: string | null
  postalCode: string | null
  city: string | null
  company: string | null
  stableName: string | null
  stableStreet: string | null
  stableCity: string | null
  stableZip: string | null
  stableContact: string | null
  stablePhone: string | null
  driveTime: string | null
  preferredDays: string[]
  directions: string | null
  notes: string | null
  createdAt: string | null
}

type NextAppointment = {
  id: string
  appointmentDate: string | null
  type: string | null
  notes: string | null
  status: string | null
  horseNames: string[]
  stableDisplay: string | null
}

type Horse = {
  id: string
  name: string
  meta: string
  nextAppointmentDate: string | null
}

type PastAppointment = {
  id: string
  appointmentDate: string | null
  type: string | null
  notes: string | null
  status: string | null
  horseNames: string[]
}

type ViewTab = 'overview' | 'termine' | 'doku' | 'rechnungen'

function getNavUrl(app: 'apple' | 'google' | 'waze', address: string): string {
  const encoded = encodeURIComponent(address.trim())
  if (app === 'apple') return `https://maps.apple.com/?daddr=${encoded}`
  if (app === 'waze') return `https://waze.com/ul?q=${encoded}&navigate=yes`
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`
}

function formatDateLong(iso: string | null): string {
  if (!iso) return '–'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '–'
  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function formatMonthShort(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('de-DE', { month: 'short' }).format(d)
}

function formatDay(iso: string | null): string {
  if (!iso) return '–'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '–'
  return String(d.getDate())
}

function formatEuro(cents: number): string {
  if (cents === 0) return '0,00 €'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

function formatKundeSeit(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(d)
}

function getStatusClass(status: string | null): string {
  if (!status) return 'cd-badge'
  const v = status.toLowerCase()
  if (v.includes('bestätigt')) return 'cd-badge cd-badge-ok'
  if (v.includes('geplant')) return 'cd-badge cd-badge-plan'
  return 'cd-badge'
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function IconDoc() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  )
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={20} height={20}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function IconEmail() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={20} height={20}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  )
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={20} height={20}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function IconChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function getCustomerIdFromPath(path: string): string {
  const m = path.match(/^\/customers\/([^/?#]+)/)
  return (m?.[1] ?? '').trim()
}

export default function MobileCustomerDetail({ customerId: customerIdProp }: { customerId?: string }) {
  const pathname = usePathname()
  const fromPath = pathname ? getCustomerIdFromPath(pathname) : ''
  const customerId = (customerIdProp && customerIdProp !== 'undefined' ? customerIdProp : fromPath) || ''

  const menuRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<ViewTab>('overview')
  const [routeTarget, setRouteTarget] = useState<'customer' | 'stable'>('customer')
  const [routeSegmentOpen, setRouteSegmentOpen] = useState(false)
  const [preferredNavApp, setPreferredNavApp] = useState<'apple' | 'google' | 'waze'>('google')
  const [data, setData] = useState<{
    customer: Customer
    nextAppointment: NextAppointment | null
    horses: Horse[]
    monthlyRevenueCents: number[]
    totalRevenueCents: number
    revenueYear: number
    monthNames: string[]
    pastAppointments: PastAppointment[]
    allAppointments: PastAppointment[]
  } | null>(null)

  useEffect(() => {
    const idFromUrl = typeof window !== 'undefined' ? getCustomerIdFromPath(window.location.pathname) : ''
    const effectiveId = (customerId && UUID_REGEX.test(customerId) ? customerId : idFromUrl) || ''
    if (!effectiveId || !UUID_REGEX.test(effectiveId)) {
      setError('Kunde konnte nicht geladen werden (keine gültige ID).')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    fetch(`/api/customers/${effectiveId}/mobile`, { credentials: 'include' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error || 'Fehler beim Laden')
        return json
      })
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Fehler'))
      .finally(() => setLoading(false))
  }, [customerId, pathname])

  useEffect(() => {
    let cancelled = false
    fetch('/api/dashboard/mobile', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((api: { preferredNavApp?: 'apple' | 'google' | 'waze' } | null) => {
        if (!cancelled && api?.preferredNavApp) setPreferredNavApp(api.preferredNavApp)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [menuOpen])

  if (loading) {
    return (
      <div className="mobile-customer-detail">
        <div className="status-bar" aria-hidden />
        <header className="mobile-header">
          <div className="cd-hero flex items-center gap-3">
            <div className="cd-info min-w-0 flex-1">
              <div className="mobile-greeting">Kunde wird geladen…</div>
            </div>
          </div>
        </header>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mobile-customer-detail">
        <div className="status-bar" aria-hidden />
        <header className="mobile-header">
          <div className="cd-hero flex items-center gap-3">
            <div className="cd-info min-w-0 flex-1">
              <div className="mobile-greeting">Kunde</div>
            </div>
          </div>
        </header>
        <div className="mobile-content">
          <div className="huf-card p-4 text-[14px] text-red-700">{error || 'Nicht gefunden.'}</div>
        </div>
      </div>
    )
  }

  const { customer, nextAppointment, horses, monthlyRevenueCents, totalRevenueCents, revenueYear, monthNames, pastAppointments, allAppointments } = data
  const displayName = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() || customer.name || 'Kunde'
  const metaParts = [
    customer.customerNumber != null ? formatCustomerNumber(customer.customerNumber) : null,
    customer.city || null,
    horses.length > 0 ? `${horses.length} Pferd${horses.length !== 1 ? 'e' : ''}` : null,
    customer.createdAt ? `Kunde seit ${formatKundeSeit(customer.createdAt)}` : null,
  ].filter(Boolean)

  const revenueRows = monthNames
    .map((name, i) => ({ name, cents: monthlyRevenueCents[i] ?? 0 }))
    .filter((r) => r.cents > 0)

  const hasCustomerAddress = !!(customer.street?.trim() || customer.postalCode || customer.city)
  const hasStableAddress = !!(customer.stableStreet?.trim() || customer.stableZip || customer.stableCity)
  const hasAnyAddress = hasCustomerAddress || hasStableAddress
  const hasBothAddresses = hasCustomerAddress && hasStableAddress

  const customerAddressString = [customer.street?.trim(), [customer.postalCode, customer.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const stableAddressString = [customer.stableStreet?.trim(), [customer.stableZip, customer.stableCity].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const customerMapsUrl = customerAddressString
    ? getNavUrl(preferredNavApp, customerAddressString)
    : null
  const stableMapsUrl = stableAddressString
    ? getNavUrl(preferredNavApp, stableAddressString)
    : null
  const directRouteUrl = !hasBothAddresses && hasAnyAddress
    ? (hasStableAddress ? stableMapsUrl : customerMapsUrl)
    : null

  return (
    <div className="mobile-customer-detail">
      <div className="status-bar" aria-hidden />
      <header className="mobile-header">
        <div className="cd-hero flex items-center gap-3">
          <div className="cd-info min-w-0 flex-1">
            <div className="cd-name">{displayName}</div>
            <div className="cd-meta flex flex-wrap items-center gap-x-1 gap-y-0.5">
              {metaParts.map((p, i) => (
                <span key={i} className="whitespace-nowrap">
                  {i > 0 && <span className="opacity-60"> · </span>}
                  {p}
                </span>
              ))}
            </div>
          </div>
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="cd-edit cd-edit--no-bg flex h-9 w-9 items-center justify-center rounded-lg bg-transparent text-white active:bg-white/10"
              aria-label="Menü"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <i className="bi bi-three-dots-vertical text-[20px]" aria-hidden />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-[#f2f2f3] bg-white py-1 shadow-lg"
                style={{ marginTop: 4 }}
              >
                <Link
                  href={`/customers/${customer.id}/edit`}
                  role="menuitem"
                  className="flex items-center gap-2 px-4 py-2.5 text-[14px] font-medium text-[#1B1F23] hover:bg-[#f7f7f7] active:bg-[#f0f0f0]"
                  onClick={() => setMenuOpen(false)}
                >
                  <i className="bi bi-pencil-square text-[14px] text-[#52b788]" />
                  Kunde bearbeiten
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="cd-action-row flex gap-2">
        <Link href={`/appointments/new?customerId=${customer.id}`} className="cd-action-btn flex flex-1 items-center justify-center gap-1.5">
          <IconCalendar />
          Termin anlegen
        </Link>
        <Link
          href={nextAppointment?.id ? `/appointments/${nextAppointment.id}` : `/appointments/new?customerId=${customer.id}`}
          className="cd-action-btn primary flex flex-1 items-center justify-center gap-1.5"
        >
          <IconDoc />
          Dokumentation
        </Link>
      </div>

      <div className="cd-tabs flex overflow-x-auto">
        {(['overview', 'termine', 'doku', 'rechnungen'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`cd-tab-item shrink-0 ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'overview' && 'Übersicht'}
            {t === 'termine' && 'Termine'}
            {t === 'doku' && 'Dokumentation'}
            {t === 'rechnungen' && 'Rechnungen'}
          </button>
        ))}
      </div>

      <div className="mobile-content">
        {tab === 'overview' && (
          <>
            <div className="cd-quick-contact flex gap-2">
              {customer.phone && (
                <a href={`tel:${customer.phone}`} className="cd-qc-btn flex flex-1 flex-col items-center gap-1.5" aria-label="Anrufen">
                  <IconPhone />
                  <span>Anrufen</span>
                </a>
              )}
              {customer.email && (
                <a href={`mailto:${customer.email}`} className="cd-qc-btn flex flex-1 flex-col items-center gap-1.5" aria-label="E-Mail">
                  <IconEmail />
                  <span>E-Mail</span>
                </a>
              )}
              {hasAnyAddress && (
                hasBothAddresses ? (
                  <button
                    type="button"
                    onClick={() => setRouteSegmentOpen((o) => !o)}
                    className="cd-qc-btn flex flex-1 flex-col items-center justify-center gap-1.5"
                    aria-label="Route – Ziel wählen"
                    aria-expanded={routeSegmentOpen}
                  >
                    <IconPin />
                    <span>Route</span>
                  </button>
                ) : directRouteUrl ? (
                  <a
                    href={directRouteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cd-qc-btn flex flex-1 flex-col items-center justify-center gap-1.5"
                    aria-label="Route zur Adresse"
                  >
                    <IconPin />
                    <span>Route</span>
                  </a>
                ) : null
              )}
            </div>

            {hasStableAddress && routeSegmentOpen && (
              <div className="cd-route-segment" role="tablist" aria-label="Adresse für Navigation">
                {customerMapsUrl && (
                  <a
                    href={customerMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`cd-route-segment-btn ${routeTarget === 'customer' ? 'active' : ''}`}
                    onClick={() => { setRouteTarget('customer'); setRouteSegmentOpen(false) }}
                  >
                    Kundenadresse
                  </a>
                )}
                {stableMapsUrl && (
                  <a
                    href={stableMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`cd-route-segment-btn ${routeTarget === 'stable' ? 'active' : ''}`}
                    onClick={() => { setRouteTarget('stable'); setRouteSegmentOpen(false) }}
                  >
                    Stalladresse
                  </a>
                )}
              </div>
            )}

            {nextAppointment && (
              <div className="cd-next-termin">
                <div className="cd-nt-header">
                  <h3>Nächster Termin</h3>
                </div>
                <div className="cd-nt-date">{formatDateLong(nextAppointment.appointmentDate)}</div>
                <div className="cd-nt-detail">
                  {nextAppointment.appointmentDate && formatTime(nextAppointment.appointmentDate)}
                  {nextAppointment.type ? ` · ${nextAppointment.type}` : ''}
                  <br />
                  {nextAppointment.stableDisplay && <>{nextAppointment.stableDisplay}<br /></>}
                  {nextAppointment.horseNames.length > 0 && `Pferde: ${nextAppointment.horseNames.join(', ')}`}
                </div>
                <div className="cd-nt-actions flex gap-2">
                  <Link href={`/calendar?customerId=${customer.id}`} className="cd-nt-btn flex-1 text-center">
                    Verschieben
                  </Link>
                  <Link
                    href={nextAppointment.id ? `/appointments/${nextAppointment.id}` : `/calendar`}
                    className="cd-nt-btn primary flex-1 text-center"
                  >
                    Dokumentieren
                  </Link>
                </div>
              </div>
            )}

            <div className="cd-section">
              <div className="cd-section-header flex justify-between items-center">
                <h3>Kontaktdaten</h3>
                <Link href={`/customers/${customer.id}/edit`}>Bearbeiten</Link>
              </div>
              <div className="cd-section-body">
                <div className="cd-dg grid grid-cols-2">
                  <div className="cd-dg-item">
                    <div className="cd-dg-label">Vorname & Nachname</div>
                    <div className="cd-dg-value">{displayName}</div>
                  </div>
                  <div className="cd-dg-item">
                    <div className="cd-dg-label">Firma</div>
                    <div className="cd-dg-value">{customer.company?.trim() || '–'}</div>
                  </div>
                  <div className="cd-dg-item">
                    <div className="cd-dg-label">Telefon</div>
                    <div className="cd-dg-value">
                      {customer.phone ? (
                        <a href={`tel:${customer.phone}`}>{customer.phone}</a>
                      ) : (
                        '–'
                      )}
                    </div>
                  </div>
                  <div className="cd-dg-item">
                    <div className="cd-dg-label">E-Mail</div>
                    <div className="cd-dg-value">
                      {customer.email ? (
                        <a href={`mailto:${customer.email}`}>{customer.email}</a>
                      ) : (
                        '–'
                      )}
                    </div>
                  </div>
                  <div className="cd-dg-item">
                    <div className="cd-dg-label">Straße & Hausnummer</div>
                    <div className="cd-dg-value">{customer.street?.trim() || '–'}</div>
                  </div>
                  <div className="cd-dg-item">
                    <div className="cd-dg-label">Ort</div>
                    <div className="cd-dg-value">
                      {[customer.postalCode, customer.city].filter(Boolean).join(' ') || '–'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="cd-section">
              <div className="cd-section-header flex justify-between items-center">
                <h3>Stalldaten</h3>
                <Link href={`/customers/${customer.id}/edit`}>Bearbeiten</Link>
              </div>
              <div className="cd-section-body">
                <div className="cd-dg grid grid-cols-2">
                  <div className="cd-dg-item">
                    <div className="cd-dg-label">Stallname</div>
                    <div className="cd-dg-value">{customer.stableName?.trim() || '–'}</div>
                  </div>
                  <div className="cd-dg-item">
                    <div className="cd-dg-label">Straße & Hausnummer</div>
                    <div className="cd-dg-value">{customer.stableStreet?.trim() || '–'}</div>
                  </div>
                  <div className="cd-dg-item">
                    <div className="cd-dg-label">Ort</div>
                    <div className="cd-dg-value">
                      {[customer.stableZip, customer.stableCity].filter(Boolean).join(' ') || '–'}
                    </div>
                  </div>
                  <div className="cd-dg-item">
                    <div className="cd-dg-label">Ansprechpartner vor Ort</div>
                    <div className="cd-dg-value">{customer.stableContact?.trim() || '–'}</div>
                  </div>
                  <div className="cd-dg-item">
                    <div className="cd-dg-label">Telefon vor Ort</div>
                    <div className="cd-dg-value">
                      {customer.stablePhone ? (
                        <a href={`tel:${customer.stablePhone}`}>{customer.stablePhone}</a>
                      ) : (
                        '–'
                      )}
                    </div>
                  </div>
                  <div className="cd-dg-item">
                    <div className="cd-dg-label">Anfahrtszeit</div>
                    <div className="cd-dg-value">{customer.driveTime || '–'}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="cd-section cd-notiz-card">
              <div className="cd-section-header flex justify-between items-center">
                <h3>Notizen</h3>
                <span className="text-[12px] font-medium text-[#52b788]">+ Notiz</span>
              </div>
              <div className="cd-notiz-body">
                {customer.notes?.trim() && <p>{customer.notes.trim()}</p>}
                {customer.preferredDays?.length > 0 && (
                  <p><strong>Bevorzugte Tage:</strong> {customer.preferredDays.join(', ')}</p>
                )}
                {customer.directions?.trim() && (
                  <p><strong>Anfahrtshinweis:</strong> {customer.directions.trim()}</p>
                )}
                {!customer.notes?.trim() && !customer.preferredDays?.length && !customer.directions?.trim() && (
                  <p className="text-[#6B7280]">Noch keine Kundennotizen hinterlegt.</p>
                )}
              </div>
            </div>

            <div className="cd-section">
              <div className="cd-section-header flex justify-between items-center">
                <h3>Pferde ({horses.length})</h3>
                <Link href={`/horses/new?customerId=${customer.id}`}>+ Pferd hinzufügen</Link>
              </div>
              <div className="cd-section-body">
                {horses.length === 0 ? (
                  <p className="text-[13px] text-[#6B7280]">Noch keine Pferde angelegt.</p>
                ) : (
                  horses.map((h) => (
                    <Link key={h.id} href={`/horses/${h.id}`} className="cd-horse-item flex items-center gap-3">
                      <div className="cd-hi-icon shrink-0">🐴</div>
                      <div className="cd-hi-info min-w-0 flex-1">
                        <div className="cd-hi-name">{h.name}</div>
                        <div className="cd-hi-breed">{h.meta}</div>
                      </div>
                      <div className="cd-hi-right shrink-0 text-right">
                        <div className="cd-hi-termin-label">Nächster Termin</div>
                        <div className="cd-hi-termin-date">
                          {h.nextAppointmentDate
                            ? new Intl.DateTimeFormat('de-DE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              }).format(new Date(h.nextAppointmentDate))
                            : '–'}
                        </div>
                      </div>
                      <span className="cd-hi-chevron" aria-hidden><IconChevronRight /></span>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {revenueRows.length > 0 && (
              <div className="cd-section cd-umsatz-card">
                <div className="cd-section-header flex justify-between items-center">
                  <h3>Umsatz {revenueYear}</h3>
                </div>
                <div className="cd-section-body">
                  {revenueRows.map((r) => (
                    <div key={r.name} className="cd-umsatz-row flex justify-between">
                      <span className="cd-ur-label">{r.name}</span>
                      <span className="cd-ur-value">{formatEuro(r.cents)}</span>
                    </div>
                  ))}
                  <div className="cd-umsatz-row cd-umsatz-total flex justify-between">
                    <span className="cd-ur-label">Gesamt {revenueYear}</span>
                    <span className="cd-ur-value">{formatEuro(totalRevenueCents)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="cd-section">
              <div className="cd-section-header flex justify-between items-center">
                <h3>Vergangene Termine</h3>
                <button type="button" className="cd-section-link" onClick={() => setTab('termine')}>
                  Alle anzeigen
                </button>
              </div>
              <div className="cd-section-body">
                {pastAppointments.length === 0 ? (
                  <p className="text-[13px] text-[#6B7280]">Noch keine vergangenen Termine.</p>
                ) : (
                  pastAppointments.map((apt) => (
                    <div key={apt.id} className="cd-past-item flex items-center gap-3">
                      <div className="cd-pi-date shrink-0 text-center">
                        <div className="cd-pi-day">{formatDay(apt.appointmentDate)}</div>
                        <div className="cd-pi-month">{formatMonthShort(apt.appointmentDate)}</div>
                      </div>
                      <div className="cd-pi-info min-w-0 flex-1">
                        <div className="cd-pi-title">
                          {apt.type || 'Termin'}
                          {apt.horseNames.length > 0 ? ` – ${apt.horseNames.join(', ')}` : ''}
                        </div>
                        <div className="cd-pi-sub">
                          {apt.notes || `${apt.horseNames.length} Pferde bearbeitet`}
                        </div>
                      </div>
                      <span className={getStatusClass(apt.status)}>{apt.status || '–'}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {tab === 'termine' && (
          <div className="cd-section">
            <div className="cd-section-header flex justify-between items-center">
              <h3>Alle Termine</h3>
              <span className="cd-section-meta">{allAppointments.length} Einträge</span>
            </div>
            <div className="cd-section-body">
              {allAppointments.length === 0 ? (
                <p className="text-[13px] text-[#6B7280]">Keine Termine.</p>
              ) : (
                allAppointments.map((apt) => (
                  <div key={apt.id} className="cd-past-item flex items-center gap-3">
                    <div className="cd-pi-date shrink-0 text-center">
                      <div className="cd-pi-day">{formatDay(apt.appointmentDate)}</div>
                      <div className="cd-pi-month">{formatMonthShort(apt.appointmentDate)}</div>
                    </div>
                    <div className="cd-pi-info min-w-0 flex-1">
                      <div className="cd-pi-title">
                        {apt.type || 'Termin'}
                        {apt.horseNames.length > 0 ? ` – ${apt.horseNames.join(', ')}` : ''}
                      </div>
                      <div className="cd-pi-sub">
                        {apt.appointmentDate && formatTime(apt.appointmentDate)}
                        {apt.notes ? ` · ${apt.notes}` : apt.horseNames.length ? ` · ${apt.horseNames.length} Pferde bearbeitet` : ''}
                      </div>
                    </div>
                    <span className={getStatusClass(apt.status)}>{apt.status || '–'}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'doku' && (
          <div className="cd-section">
            <div className="cd-section-header flex justify-between items-center">
              <h3>Dokumentationen</h3>
              <span className="cd-section-meta">{horses.map((h) => h.name).join(', ') || '–'}</span>
            </div>
            <div className="cd-section-body cd-doku-hint">
              <p className="text-[14px] font-medium text-[#6B7280]">
                Dokumentationen werden über die Pferdedetailseite angezeigt.
              </p>
              {horses.length > 0 && (
                <p className="mt-2 text-[13px]">
                  →{' '}
                  <Link href={`/horses/${horses[0].id}`} className="text-[#52b788] font-semibold">
                    {horses[0].name} öffnen
                  </Link>
                </p>
              )}
            </div>
          </div>
        )}

        {tab === 'rechnungen' && (
          <div className="cd-section cd-umsatz-card">
            <div className="cd-section-header flex justify-between items-center">
              <h3>Umsatz {revenueYear}</h3>
            </div>
            <div className="cd-section-body">
              {revenueRows.length === 0 ? (
                <p className="text-[13px] text-[#6B7280]">Noch kein Umsatz in {revenueYear}.</p>
              ) : (
                <>
                  {revenueRows.map((r) => (
                    <div key={r.name} className="cd-umsatz-row flex justify-between">
                      <span className="cd-ur-label">{r.name}</span>
                      <span className="cd-ur-value">{formatEuro(r.cents)}</span>
                    </div>
                  ))}
                  <div className="cd-umsatz-row cd-umsatz-total flex justify-between">
                    <span className="cd-ur-label">Gesamt {revenueYear}</span>
                    <span className="cd-ur-value">{formatEuro(totalRevenueCents)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
