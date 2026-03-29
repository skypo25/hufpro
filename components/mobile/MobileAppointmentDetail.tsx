'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  animalTypeIconColor,
  faIconForAnimalType,
  formatCustomerAnimalsSummary,
} from '@/lib/animalTypeDisplay'
import { useAppProfile } from '@/context/AppProfileContext'
import { animalsNavLabel, animalSingularLabel } from '@/lib/appProfile'

type ReminderStatusTone = 'ok' | 'warn' | 'muted'

type Appointment = {
  id: string
  appointmentDate: string | null
  type: string | null
  status: string | null
  notes: string | null
  durationMinutes: number
  timeRange: string
  durationLabel: string
  dateLong: string | null
  dayNum: string
  monthShort: string
  reminderStatusLine: string | null
  reminderStatusTone: ReminderStatusTone | null
  createdAtFormatted: string | null
}

type Customer = {
  id: string
  customerNumber: string | null
  name: string
  phone: string | null
  email: string | null
  preferredDays: string
  intervalLabel: string
  stableDisplay: string
  stableAddress: string
  stableAddressForNav: string
  customerAddressForNav?: string | null
  stableAddressForNavOnly?: string | null
  stableContact: string | null
  stablePhone: string | null
  directions: string | null
}

type Horse = {
  id: string
  name: string | null
  animalType?: string | null
  breed: string | null
  sex: string | null
  birthYear: number | null
  age: number | null
}

type ApiData = {
  appointment: Appointment
  customer: Customer
  horses: Horse[]
  lastAppointmentDate: string | null
  preferredNavApp?: 'apple' | 'google' | 'waze'
}

function getNavUrl(app: 'apple' | 'google' | 'waze', address: string): string {
  const encoded = encodeURIComponent(address.trim())
  if (app === 'apple') return `https://maps.apple.com/?daddr=${encoded}`
  if (app === 'waze') return `https://waze.com/ul?q=${encoded}&navigate=yes`
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`
}

function getInitials(name: string | null) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] || ''
  const second = parts[1]?.[0] || ''
  return `${first}${second}`.toUpperCase() || '?'
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function MobileAppointmentDetail({ appointmentId }: { appointmentId?: string }) {
  const { profile } = useAppProfile()
  const animalsPlural = animalsNavLabel(profile.terminology)
  const animalSingular = animalSingularLabel(profile.terminology)
  const router = useRouter()
  const pathname = usePathname()
  const idFromPath = pathname?.match(/^\/appointments\/([^/?#]+)/)?.[1] ?? ''
  const effectiveId = (appointmentId && UUID_REGEX.test(appointmentId) ? appointmentId : idFromPath) || ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ApiData | null>(null)
  const [routeSegmentOpen, setRouteSegmentOpen] = useState(false)

  useEffect(() => {
    if (!effectiveId || !UUID_REGEX.test(effectiveId)) {
      setError('Termin konnte nicht geladen werden.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    fetch(`/api/appointments/${effectiveId}/mobile`, { credentials: 'include' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error || 'Fehler beim Laden')
        return json
      })
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Fehler'))
      .finally(() => setLoading(false))
  }, [effectiveId])

  if (loading) {
    return (
      <div className="mad-root">
        <div className="mad-status-bar" aria-hidden />
        <header className="mad-header">
          <div className="mad-date-hero">
            <div className="mad-dh-cal">
              <span className="mad-dh-day">–</span>
              <span className="mad-dh-month">–</span>
            </div>
            <div className="mad-dh-info">
              <div className="mad-dh-title">Termin wird geladen…</div>
            </div>
          </div>
        </header>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mad-root">
        <div className="mad-status-bar" aria-hidden />
        <header className="mad-header">
        </header>
        <div className="mad-content">
          <div className="mad-section">
            <div className="mad-s-body">
              <p className="text-[14px] text-red-700">{error || 'Nicht gefunden.'}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const { appointment, customer, horses, lastAppointmentDate, preferredNavApp = 'google' } = data
  const isPastAppointment =
    appointment.appointmentDate && new Date(appointment.appointmentDate) < new Date()
  const isConfirmed =
    !appointment.status ||
    appointment.status.toLowerCase().includes('bestätigt') ||
    appointment.status.toLowerCase().includes('confirmed')
  const firstHorse = horses[0]
  const docUrl = firstHorse
    ? `/animals/${firstHorse.id}/records/new?appointmentId=${effectiveId}`
    : null

  const hasCustomerAddress = !!(customer.customerAddressForNav?.trim())
  const hasStableAddress = !!(customer.stableAddressForNavOnly?.trim())
  const hasAnyAddress = hasCustomerAddress || hasStableAddress || !!customer.stableAddressForNav
  const hasBothAddresses = hasCustomerAddress && hasStableAddress
  const customerMapsUrl = customer.customerAddressForNav
    ? getNavUrl(preferredNavApp, customer.customerAddressForNav)
    : null
  const stableMapsUrl = customer.stableAddressForNavOnly
    ? getNavUrl(preferredNavApp, customer.stableAddressForNavOnly)
    : customer.stableAddressForNav
      ? getNavUrl(preferredNavApp, customer.stableAddressForNav)
      : null
  const directRouteUrl =
    !hasBothAddresses && hasAnyAddress
      ? (stableMapsUrl || customerMapsUrl)
      : null

  return (
    <div className="mad-root">
      <div className="mad-status-bar" aria-hidden />
      <header className="mad-header">
        <div className="mad-ah-top">
          {!isPastAppointment && (
            <div className="mad-ah-actions">
              <Link href={`/appointments/${effectiveId}/edit`} className="mad-ah-btn" aria-label="Bearbeiten">
                <i className="bi bi-gear-fill" />
              </Link>
            </div>
          )}
        </div>
        <div className="mad-date-hero">
          <div className="mad-dh-cal">
            <span className="mad-dh-day">{appointment.dayNum}</span>
            <span className="mad-dh-month">{appointment.monthShort}</span>
          </div>
          <div className="mad-dh-info">
            <div className="mad-dh-title">{appointment.dateLong || 'Termin'}</div>
            <div className="mad-dh-time">
              <i className="bi bi-clock-fill" />
              {appointment.timeRange}
              {appointment.timeRange && ' · '}
              {appointment.durationLabel}
            </div>
          </div>
        </div>
      </header>

      <div className="mad-status-strip">
        <span className={`mad-ss-badge ${isConfirmed ? 'confirmed' : ''}`}>
          <i className="bi bi-check-circle-fill" />
          {appointment.status || 'Bestätigt'}
        </span>
        <span className="mad-ss-type">
          <i className="bi bi-arrow-repeat" />
          {appointment.type || 'Regeltermin'}
        </span>
      </div>

      {(docUrl || hasAnyAddress || customer.phone) && (
        <div className="mad-quick-actions">
          {docUrl && (
            <Link href={docUrl} className="mad-qa-btn primary">
              <i className="bi bi-file-earmark-plus-fill" />
              <span>Dokumentation</span>
            </Link>
          )}
          {hasAnyAddress &&
            (hasBothAddresses ? (
              <button
                type="button"
                onClick={() => setRouteSegmentOpen((o) => !o)}
                className="mad-qa-btn"
                aria-label="Route – Ziel wählen"
                aria-expanded={routeSegmentOpen}
              >
                <i className="bi bi-geo-alt-fill" />
                <span>Route</span>
              </button>
            ) : directRouteUrl ? (
              <a href={directRouteUrl} target="_blank" rel="noopener noreferrer" className="mad-qa-btn" aria-label="Route zur Adresse">
                <i className="bi bi-geo-alt-fill" />
                <span>Route</span>
              </a>
            ) : null)}
          {customer.phone && (
            <a href={`tel:${customer.phone.replace(/\s/g, '')}`} className="mad-qa-btn">
              <i className="bi bi-telephone-fill" />
              <span>Anrufen</span>
            </a>
          )}
        </div>
      )}

      {hasBothAddresses && routeSegmentOpen && (
        <div className="mad-route-segment-wrap">
          <div className="cd-route-segment" role="tablist" aria-label="Adresse für Navigation">
          {customerMapsUrl && (
            <a
              href={customerMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cd-route-segment-btn"
              onClick={() => setRouteSegmentOpen(false)}
            >
              Kundenadresse
            </a>
          )}
          {stableMapsUrl && (
            <a
              href={stableMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cd-route-segment-btn"
              onClick={() => setRouteSegmentOpen(false)}
            >
              Stalladresse
            </a>
          )}
          </div>
        </div>
      )}

      <div className="mad-content">
        {/* Kunde */}
        <div className="mad-section">
          <div className="mad-s-header">
            <i className="bi bi-person-fill mad-s-icon" />
            <h3>Kunde</h3>
            {customer.id ? (
              <Link href={`/customers/${customer.id}`} className="mad-s-link">
                <i className="bi bi-chevron-right" />
                Öffnen
              </Link>
            ) : null}
          </div>
          {customer.id ? (
            <div
              className="mad-customer-card"
              onClick={() => router.push(`/customers/${customer.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && router.push(`/customers/${customer.id}`)}
            >
              <div className="mad-cc-avatar">{getInitials(customer.name)}</div>
              <div className="mad-cc-info">
                <div className="mad-cc-name">{customer.name}</div>
                <div className="mad-cc-sub">
                  {customer.customerNumber ? `${customer.customerNumber} · ` : ''}
                  {customer.stableDisplay || '-'}
                </div>
              </div>
              <div className="mad-cc-actions">
                {customer.phone && (
                  <a href={`tel:${customer.phone.replace(/\s/g, '')}`} className="mad-cc-btn" onClick={(e) => e.stopPropagation()} aria-label="Anrufen">
                    <i className="bi bi-telephone-fill" />
                  </a>
                )}
                {customer.email && (
                  <a href={`mailto:${customer.email}`} className="mad-cc-btn" onClick={(e) => e.stopPropagation()} aria-label="E-Mail">
                    <i className="bi bi-envelope-fill" />
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="mad-customer-card">
              <div className="mad-cc-avatar">{getInitials(customer.name)}</div>
              <div className="mad-cc-info">
                <div className="mad-cc-name">{customer.name}</div>
                <div className="mad-cc-sub">Bitte im Bearbeiten-Modus einen Kunden zuordnen.</div>
              </div>
            </div>
          )}
          <div className="mad-s-body" style={{ paddingTop: 0 }}>
            <div className="mad-d-row">
              <span className="mad-d-label">Telefon</span>
              <span className="mad-d-value">
                {customer.phone ? (
                  <a href={`tel:${customer.phone.replace(/\s/g, '')}`} onClick={(e) => e.stopPropagation()}>
                    {customer.phone}
                  </a>
                ) : (
                  '–'
                )}
              </span>
            </div>
            <div className="mad-d-row">
              <span className="mad-d-label">E-Mail</span>
              <span className="mad-d-value">
                {customer.email ? (
                  <a href={`mailto:${customer.email}`} onClick={(e) => e.stopPropagation()}>
                    {customer.email}
                  </a>
                ) : (
                  '–'
                )}
              </span>
            </div>
            <div className="mad-d-row">
              <span className="mad-d-label">Bevorzugte Tage</span>
              <span className="mad-d-value">{customer.preferredDays}</span>
            </div>
            <div className="mad-d-row">
              <span className="mad-d-label">Intervall</span>
              <span className="mad-d-value">{customer.intervalLabel}</span>
            </div>
          </div>
        </div>

        {/* Tiere / Pferde (Profil) */}
        <div className="mad-section">
          <div className="mad-s-header">
            <i className="bi bi-heart-pulse-fill mad-s-icon" />
            <h3>{animalsPlural}</h3>
            <span className="mad-s-meta">
              {horses.length === 0
                ? `Kein ${animalSingular} zugeordnet`
                : `${formatCustomerAnimalsSummary(
                    horses.map((h) => ({ animal_type: h.animalType }))
                  )} für diesen Termin`}
            </span>
          </div>
          <div className="mad-s-body">
            {horses.map((h) => (
              <Link key={h.id} href={`/animals/${h.id}`} className="mad-horse-card">
                <div className="mad-hc-icon">
                  <FontAwesomeIcon
                    icon={faIconForAnimalType(h.animalType)}
                    className="h-[14px] w-[14px]"
                    style={{ color: animalTypeIconColor }}
                  />
                </div>
                <div className="mad-hc-info">
                  <div className="mad-hc-name">{h.name || animalSingular}</div>
                  <div className="mad-hc-breed">
                    {[h.breed, h.sex, h.age != null ? `${h.age} Jahre` : null].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <i className="bi bi-chevron-right mad-hc-chevron" />
              </Link>
            ))}
          </div>
        </div>

        {/* Stall */}
        <div className="mad-section">
          <div className="mad-s-header">
            <i className="bi bi-geo-alt-fill mad-s-icon" />
            <h3>Stall / Ort</h3>
          </div>
          <div className="mad-s-body">
            <div className="mad-stall-card">
              <div className="mad-stall-icon">
                <i className="bi bi-geo-alt-fill" />
              </div>
              <div className="mad-stall-info">
                <div className="mad-stall-name">{customer.stableDisplay || 'Adresse'}</div>
                <div className="mad-stall-address">{customer.stableAddress || '–'}</div>
                {(customer.stableContact || customer.stablePhone) && (
                  <div className="mad-stall-hint">
                    <i className="bi bi-info-circle" />
                    {customer.stableContact && `Ansprechpartner: ${customer.stableContact}`}
                    {customer.stableContact && customer.stablePhone && ' · '}
                    {customer.stablePhone}
                  </div>
                )}
                {customer.stableAddressForNav && (
                  <div className="mad-stall-actions">
                    <a href={getNavUrl(preferredNavApp, customer.stableAddressForNav)} target="_blank" rel="noopener noreferrer" className="mad-stall-btn">
                      <i className="bi bi-map-fill" />
                      Route starten
                    </a>
                    {customer.stablePhone && (
                      <a href={`tel:${customer.stablePhone.replace(/\s/g, '')}`} className="mad-stall-btn">
                        <i className="bi bi-telephone-fill" />
                        Stall anrufen
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Termin-Details */}
        <div className="mad-section">
          <div className="mad-s-header">
            <i className="bi bi-calendar-fill mad-s-icon" />
            <h3>Termin-Details</h3>
          </div>
          <div className="mad-s-body">
            <div className="mad-d-row">
              <span className="mad-d-label">Datum</span>
              <span className="mad-d-value">{appointment.dateLong || '–'}</span>
            </div>
            <div className="mad-d-row">
              <span className="mad-d-label">Uhrzeit</span>
              <span className="mad-d-value">{appointment.timeRange || '–'}</span>
            </div>
            <div className="mad-d-row">
              <span className="mad-d-label">Dauer</span>
              <span className="mad-d-value">{appointment.durationLabel}</span>
            </div>
            {appointment.reminderStatusLine && (
              <div className="mad-d-row">
                <span className="mad-d-label">Erinnerung</span>
                <span
                  className="mad-d-value"
                  style={{
                    color:
                      appointment.reminderStatusTone === 'ok'
                        ? 'var(--m-green)'
                        : appointment.reminderStatusTone === 'warn'
                          ? '#b45309'
                          : '#6B7280',
                  }}
                >
                  {appointment.reminderStatusLine}
                </span>
              </div>
            )}
            <div className="mad-d-row">
              <span className="mad-d-label">Terminart</span>
              <span className="mad-d-value">{appointment.type || 'Regeltermin'}</span>
            </div>
            <div className="mad-d-row">
              <span className="mad-d-label">Status</span>
              <span className="mad-d-value" style={{ color: 'var(--m-green)' }}>
                {appointment.status || 'Bestätigt'}
              </span>
            </div>
            {appointment.createdAtFormatted && (
              <div className="mad-d-row">
                <span className="mad-d-label">Erstellt am</span>
                <span className="mad-d-value">{appointment.createdAtFormatted}</span>
              </div>
            )}
            {lastAppointmentDate && (
              <div className="mad-d-row">
                <span className="mad-d-label">Letzter Termin</span>
                <span className="mad-d-value">{lastAppointmentDate}</span>
              </div>
            )}
          </div>
        </div>

        {/* Notizen */}
        {appointment.notes && (
          <div className="mad-section">
            <div className="mad-s-header">
              <i className="bi bi-chat-text-fill mad-s-icon" />
              <h3>Notizen</h3>
            </div>
            <div className="mad-s-body">
              <div className="mad-notiz-text">{appointment.notes}</div>
            </div>
          </div>
        )}

        {/* Actions – nur bei zukünftigen Terminen */}
        {!isPastAppointment && (
          <div className="mad-section">
            <div className="mad-s-body">
              <div className="mad-bottom-actions">
                <Link href={`/appointments/${effectiveId}/edit`} className="mad-ba-btn">
                  <i className="bi bi-arrow-left-right" />
                  Verschieben
                </Link>
                <Link href={`/appointments/${effectiveId}/edit`} className="mad-ba-btn">
                  <i className="bi bi-x-circle" />
                  Absagen
                </Link>
                <Link href={`/appointments/${effectiveId}/edit`} className="mad-ba-btn danger">
                  <i className="bi bi-trash3-fill" />
                  Löschen
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
