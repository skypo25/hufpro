import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import {
  formatCustomerNumber,
  formatGermanDate,
  getInitials,
  getAgeFromBirthYear,
} from '@/lib/format'

type PageProps = { params: Promise<{ id: string }> }

function formatTime(dateString: string | null) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatLongGermanDate(dateString: string | null) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatShortMonth(dateString: string | null) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('de-DE', { month: 'short' }).format(date)
}

function formatDay(dateString: string | null) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric' }).format(date)
}

function durationLabel(minutes: number | null) {
  if (minutes == null) return '1 Stunde'
  if (minutes === 60) return '1 Stunde'
  if (minutes === 30) return '30 Minuten'
  if (minutes === 45) return '45 Minuten'
  if (minutes === 90) return '1,5 Stunden'
  if (minutes === 120) return '2 Stunden'
  return `${minutes} Minuten`
}

function getWeekNumber(date: Date) {
  const target = new Date(date.valueOf())
  const dayNr = (date.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = new Date(target.getFullYear(), 0, 4)
  const firstDayNr = (firstThursday.getDay() + 6) % 7
  firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3)
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / 604800000)
}

function buildStableAddress(
  c: {
    stable_differs?: boolean | null
    stable_street?: string | null
    stable_zip?: string | null
    stable_city?: string | null
    street?: string | null
    postal_code?: string | null
    city?: string | null
  },
  forNav = false
) {
  const useStable =
    c.stable_differs &&
    (c.stable_street?.trim() || c.stable_zip?.trim() || c.stable_city?.trim())
  if (useStable) {
    const parts = [c.stable_street, [c.stable_zip, c.stable_city].filter(Boolean).join(' ')].filter(
      Boolean
    )
    return forNav ? parts.join(', ') : parts.join('\n')
  }
  const parts = [c.street, [c.postal_code, c.city].filter(Boolean).join(' ')].filter(Boolean)
  return forNav ? parts.join(', ') : parts.join('\n')
}

function getNavUrl(address: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.trim())}`
}

export default async function AppointmentDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: appointment, error: aptErr } = await supabase
    .from('appointments')
    .select('id, customer_id, appointment_date, notes, type, status, duration_minutes, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (aptErr || !appointment) notFound()

  const customerId = appointment.customer_id
  if (!customerId) notFound()

  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .select(
      'id, customer_number, name, first_name, last_name, phone, email, street, postal_code, city, country, company, stable_differs, stable_name, stable_street, stable_city, stable_zip, stable_country, stable_contact, stable_phone, drive_time, preferred_days, directions, interval_weeks, preferred_contact, created_at'
    )
    .eq('id', customerId)
    .eq('user_id', user.id)
    .single()

  if (custErr || !customer) notFound()

  const { data: aptHorseRows } = await supabase
    .from('appointment_horses')
    .select('horse_id')
    .eq('appointment_id', id)
    .eq('user_id', user.id)

  const horseIds = (aptHorseRows || []).map((r) => r.horse_id)
  let horses: Array<{
    id: string
    name: string | null
    breed: string | null
    sex: string | null
    birth_year: number | null
    hoof_status: string | null
    care_interval: string | null
  }> = []

  if (horseIds.length > 0) {
    const { data: horseData } = await supabase
      .from('horses')
      .select('id, name, breed, sex, birth_year, hoof_status, care_interval')
      .eq('user_id', user.id)
      .in('id', horseIds)
    horses = horseData || []
  }

  const { data: pastApts } = await supabase
    .from('appointments')
    .select('id, appointment_date, type, status')
    .eq('customer_id', customerId)
    .eq('user_id', user.id)
    .not('appointment_date', 'is', null)
    .order('appointment_date', { ascending: false })
    .limit(10)

  const pastAppointments = (pastApts || []).filter(
    (a) => a.appointment_date && new Date(a.appointment_date) < new Date()
  )

  const customerName = customer.name || [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Kunde'
  const horseNames = horses.map((h) => h.name).filter(Boolean)
  const title = `${customerName}${horseNames.length > 0 ? ' · ' + horseNames.join(', ') : ''}`

  const aptDate = appointment.appointment_date
  const startTime = formatTime(aptDate)
  const duration = appointment.duration_minutes ?? 60
  const endDate = aptDate ? new Date(new Date(aptDate).getTime() + duration * 60 * 1000) : null
  const endTime = endDate ? formatTime(endDate.toISOString()) : ''
  const timeRange = startTime && endTime ? `${startTime} – ${endTime} Uhr` : ''

  const stableAddress = buildStableAddress(customer)
  const stableAddressForNav = buildStableAddress(customer, true)
  const locationLabel = customer.stable_name || customer.stable_city || customer.city || ''

  const weekNum = aptDate ? getWeekNumber(new Date(aptDate)) : null
  const breadcrumbKw = weekNum ? `KW ${weekNum}` : 'Termine'

  const intervalLabel =
    customer.interval_weeks != null
      ? `${customer.interval_weeks} Wochen`
      : horses[0]?.care_interval || '-'

  const preferredDays = Array.isArray(customer.preferred_days)
    ? customer.preferred_days.join(', ')
    : customer.preferred_days || '-'

  const preferredContact = customer.preferred_contact || '-'

  const custSince = customer.created_at
    ? new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(
        new Date(customer.created_at)
      )
    : '-'

  const isConfirmed =
    !appointment.status ||
    appointment.status.toLowerCase().includes('bestätigt') ||
    appointment.status.toLowerCase().includes('confirmed')

  const isPastAppointment = aptDate && new Date(aptDate) < new Date()

  return (
    <main className="mx-auto max-w-[1280px] w-full space-y-7">
      <nav className="apt-detail-breadcrumb">
        <Link href="/dashboard">Dashboard</Link>
        <span> › </span>
        <Link href="/calendar">Termine</Link>
        <span> › </span>
        <Link href="/calendar">{breadcrumbKw}</Link>
        <span>
          {' '}
          › {aptDate ? formatLongGermanDate(aptDate) : ''} · {customerName}
        </span>
      </nav>

      <div className="apt-detail-header">
        <div className="apt-detail-ph-cal">
          <span className="apt-detail-ph-day">{aptDate ? formatDay(aptDate) : '–'}</span>
          <span className="apt-detail-ph-month">{aptDate ? formatShortMonth(aptDate) : ''}</span>
        </div>
        <div className="apt-detail-ph-info">
          <h1 className="apt-detail-ph-title">{title}</h1>
          <div className="apt-detail-ph-meta">
            <i className="bi bi-clock-fill" />
            {timeRange}
            {timeRange && ' · '}
            {durationLabel(duration)}
            {locationLabel && (
              <>
                <i className="bi bi-geo-alt-fill" style={{ marginLeft: 8 }} />
                {locationLabel}
              </>
            )}
          </div>
          <div className="apt-detail-ph-badges">
            <span className={`apt-detail-ph-badge ${isConfirmed ? 'confirmed' : 'open'}`}>
              <i className="bi bi-check-circle-fill" />
              {appointment.status || 'Bestätigt'}
            </span>
            <span className="apt-detail-ph-badge type">
              <i className="bi bi-arrow-repeat" />
              {appointment.type || 'Regeltermin'}
            </span>
          </div>
        </div>
        <div className="apt-detail-ph-actions">
          {!isPastAppointment && (
            <Link href={`/appointments/${id}/edit`} className="apt-detail-btn">
              <i className="bi bi-pencil-fill" />
              Bearbeiten
            </Link>
          )}
          {horses[0] && (
            <Link
              href={`/horses/${horses[0].id}/records/new?appointmentId=${id}`}
              className="apt-detail-btn primary"
            >
              <i className="bi bi-file-earmark-plus-fill" />
              Dokumentation
            </Link>
          )}
        </div>
      </div>

      <div className="apt-detail-grid">
        <div>
          <section className="apt-detail-section">
            <div className="apt-detail-s-header">
              <i className="bi bi-person-fill apt-detail-s-icon" />
              <h3>Kunde</h3>
              <Link href={`/customers/${customer.id}`} className="apt-detail-s-link">
                <i className="bi bi-chevron-right" />
                Kundenakte öffnen
              </Link>
            </div>
            <div className="apt-detail-customer-card">
              <div className="apt-detail-cc-avatar">{getInitials(customerName)}</div>
              <div className="apt-detail-cc-info">
                <div className="apt-detail-cc-name">{customerName}</div>
                <div className="apt-detail-cc-sub">
                  {formatCustomerNumber(customer.customer_number)} · Kundin seit {custSince}
                </div>
              </div>
              <div className="apt-detail-cc-actions">
                {customer.phone && (
                  <a
                    href={`tel:${customer.phone.replace(/\s/g, '')}`}
                    className="apt-detail-cc-btn"
                    title="Anrufen"
                  >
                    <i className="bi bi-telephone-fill" />
                  </a>
                )}
                {customer.email && (
                  <a
                    href={`mailto:${customer.email}`}
                    className="apt-detail-cc-btn"
                    title="E-Mail"
                  >
                    <i className="bi bi-envelope-fill" />
                  </a>
                )}
                {stableAddressForNav && (
                  <a
                    href={getNavUrl(stableAddressForNav)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="apt-detail-cc-btn"
                    title="Route"
                  >
                    <i className="bi bi-geo-alt-fill" />
                  </a>
                )}
              </div>
            </div>
            <div className="apt-detail-s-body" style={{ paddingTop: 0 }}>
              <div className="apt-detail-d-row">
                <span className="apt-detail-d-label">Telefon</span>
                <span className="apt-detail-d-value">
                  {customer.phone ? (
                    <a href={`tel:${customer.phone.replace(/\s/g, '')}`}>{customer.phone}</a>
                  ) : (
                    '–'
                  )}
                </span>
              </div>
              <div className="apt-detail-d-row">
                <span className="apt-detail-d-label">E-Mail</span>
                <span className="apt-detail-d-value">
                  {customer.email ? (
                    <a href={`mailto:${customer.email}`}>{customer.email}</a>
                  ) : (
                    '–'
                  )}
                </span>
              </div>
              <div className="apt-detail-d-row">
                <span className="apt-detail-d-label">Bevorzugte Tage</span>
                <span className="apt-detail-d-value">{preferredDays}</span>
              </div>
              <div className="apt-detail-d-row">
                <span className="apt-detail-d-label">Bearbeitungsintervall</span>
                <span className="apt-detail-d-value">{intervalLabel}</span>
              </div>
              <div className="apt-detail-d-row">
                <span className="apt-detail-d-label">Bevorzugter Kontaktweg</span>
                <span className="apt-detail-d-value">{preferredContact}</span>
              </div>
            </div>
          </section>

          <section className="apt-detail-section">
            <div className="apt-detail-s-header">
              <i className="bi bi-heart-pulse-fill apt-detail-s-icon" />
              <h3>Pferde</h3>
              <span className="apt-detail-s-meta">
                {horses.length} {horses.length === 1 ? 'Pferd' : 'Pferde'} für diesen Termin
              </span>
            </div>
            <div className="apt-detail-s-body">
              {horses.length === 0 ? (
                <p className="apt-detail-empty">Kein Pferd zugeordnet</p>
              ) : (
                horses.map((horse) => {
                  const age = getAgeFromBirthYear(horse.birth_year)
                  const sexLabel =
                    horse.sex === 'male'
                      ? 'Hengst'
                      : horse.sex === 'female'
                        ? 'Stute'
                        : horse.sex === 'gelding'
                          ? 'Wallach'
                          : horse.sex || ''
                  const meta = [
                    horse.breed,
                    sexLabel,
                    age ? `${age} Jahre` : null,
                    horse.hoof_status,
                    horse.care_interval ? `Intervall ${horse.care_interval}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                  return (
                    <Link
                      key={horse.id}
                      href={`/horses/${horse.id}`}
                      className="apt-detail-horse-item"
                    >
                      <div className="apt-detail-hi-icon">
                        <i className="bi bi-heart-pulse-fill" />
                      </div>
                      <div className="apt-detail-hi-info">
                        <div className="apt-detail-hi-name">{horse.name || '–'}</div>
                        <div className="apt-detail-hi-breed">{meta || '–'}</div>
                      </div>
                      <i className="bi bi-chevron-right apt-detail-hi-chevron" />
                    </Link>
                  )
                })
              )}
            </div>
          </section>

          <section className="apt-detail-section">
            <div className="apt-detail-s-header">
              <i className="bi bi-geo-alt-fill apt-detail-s-icon" />
              <h3>Stall / Ort</h3>
            </div>
            <div className="apt-detail-s-body">
              <div className="apt-detail-stall-block">
                <div className="apt-detail-stall-icon">
                  <i className="bi bi-geo-alt-fill" />
                </div>
                <div className="apt-detail-stall-info">
                  <div className="apt-detail-stall-name">
                    {customer.stable_name || customer.city || '–'}
                  </div>
                  <div className="apt-detail-stall-address">
                    {stableAddress.split('\n').map((line, i) => (
                      <span key={i}>
                        {line}
                        <br />
                      </span>
                    ))}
                  </div>
                  {(customer.stable_contact || customer.stable_phone) && (
                    <div className="apt-detail-stall-contact">
                      <i className="bi bi-person-fill" />
                      Ansprechpartner: {customer.stable_contact || '–'}
                      {customer.stable_phone && ` · ${customer.stable_phone}`}
                    </div>
                  )}
                  {customer.directions && (
                    <div className="apt-detail-stall-hint">
                      <i className="bi bi-signpost-fill" />
                      {customer.directions}
                    </div>
                  )}
                  <div className="apt-detail-stall-actions">
                    {stableAddressForNav && (
                      <a
                        href={getNavUrl(stableAddressForNav)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="apt-detail-btn"
                      >
                        <i className="bi bi-map-fill" />
                        Route starten
                      </a>
                    )}
                    {customer.stable_phone && (
                      <a href={`tel:${customer.stable_phone.replace(/\s/g, '')}`} className="apt-detail-btn">
                        <i className="bi bi-telephone-fill" />
                        Stall anrufen
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {appointment.notes && (
            <section className="apt-detail-section">
              <div className="apt-detail-s-header">
                <i className="bi bi-chat-text-fill apt-detail-s-icon" />
                <h3>Notizen zum Termin</h3>
              </div>
              <div className="apt-detail-s-body">
                <div className="apt-detail-notiz-text">{appointment.notes}</div>
              </div>
            </section>
          )}
        </div>

        <div>
          <div className="apt-detail-sp">
            <div className="apt-detail-sp-header">
              <i className="bi bi-lightning-fill" />
              <h4>Aktionen</h4>
            </div>
            <div className="apt-detail-sp-body">
              <div className="apt-detail-qa-list">
                {horses[0] && (
                  <Link
                    href={`/horses/${horses[0].id}/records/new?appointmentId=${id}`}
                    className="apt-detail-qa-item primary"
                  >
                    <i className="bi bi-file-earmark-plus-fill" />
                    Dokumentation starten
                  </Link>
                )}
                {stableAddressForNav && (
                  <a
                    href={getNavUrl(stableAddressForNav)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="apt-detail-qa-item"
                  >
                    <i className="bi bi-geo-alt-fill" />
                    Route zum Stall
                  </a>
                )}
                {customer.phone && (
                  <a href={`tel:${customer.phone.replace(/\s/g, '')}`} className="apt-detail-qa-item">
                    <i className="bi bi-telephone-fill" />
                    Kunde anrufen
                  </a>
                )}
                {customer.email && (
                  <a href={`mailto:${customer.email}`} className="apt-detail-qa-item">
                    <i className="bi bi-envelope-fill" />
                    E-Mail senden
                  </a>
                )}
                {!isPastAppointment && (
                  <Link href={`/appointments/${id}/edit`} className="apt-detail-qa-item">
                    <i className="bi bi-arrow-left-right" />
                    Termin verschieben
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="apt-detail-sp">
            <div className="apt-detail-sp-header">
              <i className="bi bi-calendar-fill" />
              <h4>Termin-Details</h4>
            </div>
            <div className="apt-detail-sp-body">
              <div className="apt-detail-d-row">
                <span className="apt-detail-d-label">Datum</span>
                <span className="apt-detail-d-value">
                  {aptDate ? formatLongGermanDate(aptDate) : '–'}
                </span>
              </div>
              <div className="apt-detail-d-row">
                <span className="apt-detail-d-label">Uhrzeit</span>
                <span className="apt-detail-d-value">{timeRange || '–'}</span>
              </div>
              <div className="apt-detail-d-row">
                <span className="apt-detail-d-label">Dauer</span>
                <span className="apt-detail-d-value">{durationLabel(duration)}</span>
              </div>
              <div className="apt-detail-d-row">
                <span className="apt-detail-d-label">Terminart</span>
                <span className="apt-detail-d-value">{appointment.type || 'Regeltermin'}</span>
              </div>
              <div className="apt-detail-d-row">
                <span className="apt-detail-d-label">Status</span>
                <span className="apt-detail-d-value" style={{ color: 'var(--apt-accent)' }}>
                  {appointment.status || 'Bestätigt'}
                </span>
              </div>
              {appointment.created_at && (
                <div className="apt-detail-d-row">
                  <span className="apt-detail-d-label">Erstellt am</span>
                  <span className="apt-detail-d-value">
                    {formatGermanDate(appointment.created_at)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {pastAppointments.length > 0 && (
            <div className="apt-detail-sp">
              <div className="apt-detail-sp-header">
                <i className="bi bi-clock-history" />
                <h4>Terminverlauf</h4>
              </div>
              <div className="apt-detail-sp-body">
                {pastAppointments.map((past, i) => {
                  const isCurrent = past.id === id
                  return (
                    <div key={past.id} className="apt-detail-tl-item">
                      <div className={`apt-detail-tl-dot ${isCurrent ? '' : 'gray'}`} />
                      <div className="apt-detail-tl-text">
                        <strong>
                          {past.appointment_date
                            ? formatGermanDate(past.appointment_date)
                            : '–'}
                        </strong>
                        {isCurrent ? ' — Aktueller Termin' : ''}
                        <br />
                        <span className="apt-detail-tl-date">
                          {past.type || 'Regeltermin'} · {past.status || 'Bestätigt'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
