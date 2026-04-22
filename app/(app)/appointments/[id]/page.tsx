import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import {
  formatCustomerNumber,
  formatGermanDate,
  formatPreferredDaysGerman,
  getInitials,
  getAgeFromBirthYear,
} from '@/lib/format'
import { getAppointmentStartEndFromRow } from '@/lib/appointments/appointmentDisplay'
import { minutesToDurationLabelDesktop } from '@/lib/appointments/appointmentDuration'
import { getAppointmentReminderStatusLine } from '@/lib/reminders/reminderStatus'
import {
  buildBillingNavLineFromCustomer,
  buildStallMultilineFromHorse,
  buildStallNavLineFromHorse,
  pickPrimaryStallHorse,
  stallDisplayLabel,
} from '@/lib/nav/horseStableAddress'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faIconForAnimalType } from '@/lib/animalTypeDisplay'

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

function getWeekNumber(date: Date) {
  const target = new Date(date.valueOf())
  const dayNr = (date.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = new Date(target.getFullYear(), 0, 4)
  const firstDayNr = (firstThursday.getDay() + 6) % 7
  firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3)
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / 604800000)
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
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (aptErr || !appointment) notFound()

  const customerId = appointment.customer_id
  if (!customerId) {
    redirect(`/appointments/${id}/edit`)
  }

  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .select(
      'id, customer_number, name, first_name, last_name, phone, email, street, postal_code, city, country, company, drive_time, preferred_days, interval_weeks, preferred_contact, created_at'
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
    animal_type?: string | null
    breed: string | null
    sex: string | null
    birth_year: number | null
    hoof_status: string | null
    care_interval: string | null
    stable_name?: string | null
    stable_street?: string | null
    stable_zip?: string | null
    stable_city?: string | null
    stable_country?: string | null
    stable_contact?: string | null
    stable_phone?: string | null
    stable_directions?: string | null
  }> = []

  if (horseIds.length > 0) {
    const { data: horseData } = await supabase
      .from('horses')
      .select(
        'id, name, animal_type, breed, sex, birth_year, hoof_status, care_interval, stable_name, stable_street, stable_zip, stable_city, stable_country, stable_contact, stable_phone, stable_directions'
      )
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
  const slot = getAppointmentStartEndFromRow(aptDate, appointment.duration_minutes)
  const startTime = slot ? formatTime(slot.startIso) : ''
  const endTime = slot ? formatTime(slot.endIso) : ''
  const timeRange = startTime && endTime ? `${startTime} – ${endTime} Uhr` : ''
  const durationDisplay = minutesToDurationLabelDesktop(appointment.duration_minutes)
  const reminderStatus = getAppointmentReminderStatusLine({
    reminderMinutesBefore: appointment.reminder_minutes_before,
    reminderEmailSentAt: appointment.reminder_email_sent_at,
    reminderEmailError:
      'reminder_email_error' in appointment
        ? (appointment as { reminder_email_error?: string | null }).reminder_email_error
        : undefined,
    appointmentDate: appointment.appointment_date,
  })

  const stallHorse = pickPrimaryStallHorse(horses)
  const billingNav = buildBillingNavLineFromCustomer(customer) || ''
  const stallNav = stallHorse ? buildStallNavLineFromHorse(stallHorse) : null
  const stableAddress = stallHorse ? buildStallMultilineFromHorse(stallHorse) : ''
  const locationLabel = stallDisplayLabel(stallHorse ?? {}, customer.city) || customer.city || ''

  const weekNum = aptDate ? getWeekNumber(new Date(aptDate)) : null
  const breadcrumbKw = weekNum ? `KW ${weekNum}` : 'Termine'

  const intervalLabel =
    customer.interval_weeks != null
      ? `${customer.interval_weeks} Wochen`
      : horses[0]?.care_interval || '-'

  const preferredDays = Array.isArray(customer.preferred_days)
    ? formatPreferredDaysGerman(customer.preferred_days)
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
            {durationDisplay}
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
              href={`/animals/${horses[0].id}/records/new?appointmentId=${id}`}
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
                {billingNav && (
                  <a
                    href={getNavUrl(billingNav)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="apt-detail-cc-btn"
                    title="Route zur Rechnungsadresse"
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
                      href={`/animals/${horse.id}`}
                      className="apt-detail-horse-item"
                    >
                      <div className="apt-detail-hi-icon">
                        <FontAwesomeIcon
                          icon={faIconForAnimalType(horse.animal_type)}
                          className="h-4 w-4"
                        />
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
                    {stallHorse
                      ? stallDisplayLabel(stallHorse, customer.city) || '–'
                      : 'Kein Stall hinterlegt'}
                  </div>
                  <div className="apt-detail-stall-address">
                    {stableAddress
                      ? stableAddress.split('\n').map((line, i) => (
                          <span key={i}>
                            {line}
                            <br />
                          </span>
                        ))
                      : '–'}
                  </div>
                  {(stallHorse?.stable_contact || stallHorse?.stable_phone) && (
                    <div className="apt-detail-stall-contact">
                      <i className="bi bi-person-fill" />
                      Ansprechpartner: {stallHorse?.stable_contact || '–'}
                      {stallHorse?.stable_phone && ` · ${stallHorse.stable_phone}`}
                    </div>
                  )}
                  {stallHorse?.stable_directions && (
                    <div className="apt-detail-stall-hint">
                      <i className="bi bi-signpost-fill" />
                      {stallHorse.stable_directions}
                    </div>
                  )}
                  <div className="apt-detail-stall-actions">
                    {stallNav && (
                      <a
                        href={getNavUrl(stallNav)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="apt-detail-btn"
                      >
                        <i className="bi bi-map-fill" />
                        Route zum Stall
                      </a>
                    )}
                    {billingNav && stallNav && (
                      <a
                        href={getNavUrl(billingNav)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="apt-detail-btn"
                      >
                        <i className="bi bi-house-fill" />
                        Route zum Kunden
                      </a>
                    )}
                    {stallHorse?.stable_phone && (
                      <a
                        href={`tel:${stallHorse.stable_phone.replace(/\s/g, '')}`}
                        className="apt-detail-btn"
                      >
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
                    href={`/animals/${horses[0].id}/records/new?appointmentId=${id}`}
                    className="apt-detail-qa-item primary"
                  >
                    <i className="bi bi-file-earmark-plus-fill" />
                    Dokumentation starten
                  </Link>
                )}
                {stallNav && (
                  <a
                    href={getNavUrl(stallNav)}
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
                <span className="apt-detail-d-value">{durationDisplay}</span>
              </div>
              {reminderStatus && (
                <div className="apt-detail-d-row">
                  <span className="apt-detail-d-label">Erinnerung</span>
                  <span
                    className="apt-detail-d-value"
                    style={{
                      color:
                        reminderStatus.tone === 'ok'
                          ? 'var(--apt-accent)'
                          : reminderStatus.tone === 'warn'
                            ? '#b45309'
                            : '#6B7280',
                    }}
                  >
                    {reminderStatus.text}
                  </span>
                </div>
              )}
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
