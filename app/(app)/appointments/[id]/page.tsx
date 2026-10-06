import Link from 'next/link'
import type { ReactNode } from 'react'
import { redirect, notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import AppPage from '@/components/layout/AppPage'
import SectionCard from '@/components/ui/SectionCard'
import {
  formatCustomerNumber,
  formatGermanDate,
  formatPreferredDaysGerman,
  getInitials,
  getAgeFromBirthYear,
} from '@/lib/format'
import {
  formatAppointmentDayDe,
  formatAppointmentLongDateDe,
  formatAppointmentShortMonthDe,
  formatAppointmentTimeRangeDe,
} from '@/lib/appointments/appointmentDisplay'
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

function getNavUrl(address: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.trim())}`
}

function SectionTitle({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-light)] text-[14px] text-[var(--accent)]">
        <i className={`bi ${icon}`} aria-hidden />
      </span>
      {children}
    </span>
  )
}

function DetailRow({
  label,
  children,
  valueClassName = '',
}: {
  label: string
  children: ReactNode
  valueClassName?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#E5E2DC] py-3 last:border-b-0">
      <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">{label}</span>
      <span className={`text-right text-[14px] font-medium text-[#1B1F23] ${valueClassName}`}>{children}</span>
    </div>
  )
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
  const timeRange = formatAppointmentTimeRangeDe(aptDate, appointment.duration_minutes)
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
    <AppPage>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="content-card flex h-16 w-16 shrink-0 flex-col items-center justify-center">
            <span className="text-[26px] font-semibold leading-none text-[#1B1F23]">
              {aptDate ? formatAppointmentDayDe(aptDate) : '–'}
            </span>
            <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF]">
              {aptDate ? formatAppointmentShortMonthDe(aptDate) : ''}
            </span>
          </div>
          <div>
            <h1 className="dashboard-serif text-[26px] font-medium tracking-[-0.02em] text-[#1B1F23]">
              {title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[#6B7280]">
              <span className="inline-flex items-center gap-1.5">
                <i className="bi bi-clock text-[14px]" />
                {timeRange}
                {timeRange ? ` · ${durationDisplay}` : durationDisplay}
              </span>
              {locationLabel ? (
                <span className="inline-flex items-center gap-1.5">
                  <i className="bi bi-geo-alt text-[14px]" />
                  {locationLabel}
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold ${
                  isConfirmed
                    ? 'bg-[var(--accent-light)] text-[var(--accent)]'
                    : 'bg-[#FDF6EC] text-[#B8860B]'
                }`}
              >
                <i className="bi bi-check-circle-fill text-[12px]" />
                {appointment.status || 'Bestätigt'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[#DBEAFE] px-2.5 py-1 text-[12px] font-semibold text-[#1D4ED8]">
                <i className="bi bi-arrow-repeat text-[12px]" />
                {appointment.type || 'Regeltermin'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {!isPastAppointment && (
            <Link href={`/appointments/${id}/edit`} className="secondary-button">
              <i className="bi bi-pencil-square text-[14px]" />
              Bearbeiten
            </Link>
          )}
          {horses[0] && (
            <Link
              href={`/animals/${horses[0].id}/records/new?appointmentId=${id}`}
              className="primary-button"
            >
              <i className="bi bi-file-earmark-plus-fill text-[14px]" />
              Dokumentation
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-7">
          <SectionCard
            title={<SectionTitle icon="bi-person-fill">Kunde</SectionTitle>}
            right={
              <Link href={`/customers/${customer.id}`} className="text-[13px] font-medium text-primary hover:underline">
                Kundenakte öffnen
              </Link>
            }
          >
            <div className="flex items-center gap-3.5 border-b border-[#E5E2DC] px-[22px] py-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-[15px] font-bold text-white">
                {getInitials(customerName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-[#1B1F23]">{customerName}</div>
                <div className="text-[12px] text-[#6B7280]">
                  {formatCustomerNumber(customer.customer_number)} · Kundin seit {custSince}
                </div>
              </div>
              <div className="flex gap-1.5">
                {customer.phone && (
                  <a
                    href={`tel:${customer.phone.replace(/\s/g, '')}`}
                    className="secondary-button"
                    title="Anrufen"
                  >
                    <i className="bi bi-telephone-fill" />
                  </a>
                )}
                {customer.email && (
                  <a href={`mailto:${customer.email}`} className="secondary-button" title="E-Mail">
                    <i className="bi bi-envelope-fill" />
                  </a>
                )}
                {billingNav && (
                  <a
                    href={getNavUrl(billingNav)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="secondary-button"
                    title="Route zur Rechnungsadresse"
                  >
                    <i className="bi bi-geo-alt-fill" />
                  </a>
                )}
              </div>
            </div>
            <div className="px-[22px]">
              <DetailRow label="Telefon">
                {customer.phone ? (
                  <a href={`tel:${customer.phone.replace(/\s/g, '')}`} className="text-primary hover:underline">
                    {customer.phone}
                  </a>
                ) : (
                  '–'
                )}
              </DetailRow>
              <DetailRow label="E-Mail">
                {customer.email ? (
                  <a href={`mailto:${customer.email}`} className="text-primary hover:underline">
                    {customer.email}
                  </a>
                ) : (
                  '–'
                )}
              </DetailRow>
              <DetailRow label="Bevorzugte Tage">{preferredDays}</DetailRow>
              <DetailRow label="Bearbeitungsintervall">{intervalLabel}</DetailRow>
              <DetailRow label="Bevorzugter Kontaktweg">{preferredContact}</DetailRow>
            </div>
          </SectionCard>

          <SectionCard
            title={<SectionTitle icon="bi-heart-pulse-fill">Pferde</SectionTitle>}
            right={
              <span className="text-[12px] text-[#6B7280]">
                {horses.length} {horses.length === 1 ? 'Pferd' : 'Pferde'} für diesen Termin
              </span>
            }
          >
            <div className="px-[22px]">
              {horses.length === 0 ? (
                <p className="py-4 text-[13px] text-[#6B7280]">Kein Pferd zugeordnet</p>
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
                      className="flex items-center gap-3 border-b border-[#E5E2DC] py-3.5 last:border-b-0 hover:opacity-80"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-light)] text-[var(--accent)]">
                        <FontAwesomeIcon icon={faIconForAnimalType(horse.animal_type)} className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold text-[#1B1F23]">{horse.name || '–'}</div>
                        <div className="text-[12px] text-[#6B7280]">{meta || '–'}</div>
                      </div>
                      <i className="bi bi-chevron-right text-[13px] text-[#9CA3AF]" />
                    </Link>
                  )
                })
              )}
            </div>
          </SectionCard>

          <SectionCard title={<SectionTitle icon="bi-geo-alt-fill">Stall / Ort</SectionTitle>}>
            <div className="flex gap-3.5 p-[22px]">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FEF3C7] text-[#D97706]">
                <i className="bi bi-geo-alt-fill" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-[#1B1F23]">
                  {stallHorse ? stallDisplayLabel(stallHorse, customer.city) || '–' : 'Kein Stall hinterlegt'}
                </div>
                <div className="mt-1 text-[13px] leading-relaxed text-[#6B7280]">
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
                  <div className="mt-2 text-[13px] text-[#6B7280]">
                    <i className="bi bi-person-fill mr-1" />
                    Ansprechpartner: {stallHorse?.stable_contact || '–'}
                    {stallHorse?.stable_phone && ` · ${stallHorse.stable_phone}`}
                  </div>
                )}
                {stallHorse?.stable_directions && (
                  <div className="mt-2 rounded-lg bg-[#F7F7F7] px-3 py-2 text-[13px] text-[#6B7280]">
                    <i className="bi bi-signpost-fill mr-1" />
                    {stallHorse.stable_directions}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {stallNav && (
                    <a
                      href={getNavUrl(stallNav)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="secondary-button"
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
                      className="secondary-button"
                    >
                      <i className="bi bi-house-fill" />
                      Route zum Kunden
                    </a>
                  )}
                  {stallHorse?.stable_phone && (
                    <a href={`tel:${stallHorse.stable_phone.replace(/\s/g, '')}`} className="secondary-button">
                      <i className="bi bi-telephone-fill" />
                      Stall anrufen
                    </a>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>

          {appointment.notes ? (
            <SectionCard title={<SectionTitle icon="bi-chat-text-fill">Notizen zum Termin</SectionTitle>}>
              <p className="whitespace-pre-wrap px-[22px] py-4 text-[14px] leading-relaxed text-[#1B1F23]">
                {appointment.notes}
              </p>
            </SectionCard>
          ) : null}
        </div>

        <div className="space-y-7">
          <SectionCard title={<SectionTitle icon="bi-lightning-fill">Aktionen</SectionTitle>}>
            <div className="flex flex-col gap-2 p-[18px]">
              {horses[0] && (
                <Link
                  href={`/animals/${horses[0].id}/records/new?appointmentId=${id}`}
                  className="primary-button w-full justify-start"
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
                  className="secondary-button w-full justify-start"
                >
                  <i className="bi bi-geo-alt-fill" />
                  Route zum Stall
                </a>
              )}
              {customer.phone && (
                <a href={`tel:${customer.phone.replace(/\s/g, '')}`} className="secondary-button w-full justify-start">
                  <i className="bi bi-telephone-fill" />
                  Kunde anrufen
                </a>
              )}
              {customer.email && (
                <a href={`mailto:${customer.email}`} className="secondary-button w-full justify-start">
                  <i className="bi bi-envelope-fill" />
                  E-Mail senden
                </a>
              )}
              {!isPastAppointment && (
                <Link href={`/appointments/${id}/edit`} className="secondary-button w-full justify-start">
                  <i className="bi bi-arrow-left-right" />
                  Termin verschieben
                </Link>
              )}
            </div>
          </SectionCard>

          <SectionCard title={<SectionTitle icon="bi-calendar-fill">Termin-Details</SectionTitle>}>
            <div className="px-[22px]">
              <DetailRow label="Datum">{aptDate ? formatAppointmentLongDateDe(aptDate) : '–'}</DetailRow>
              <DetailRow label="Uhrzeit">{timeRange || '–'}</DetailRow>
              <DetailRow label="Dauer">{durationDisplay}</DetailRow>
              {reminderStatus ? (
                <DetailRow
                  label="Erinnerung"
                  valueClassName={
                    reminderStatus.tone === 'ok'
                      ? 'text-primary'
                      : reminderStatus.tone === 'warn'
                        ? 'text-[#b45309]'
                        : 'text-[#6B7280]'
                  }
                >
                  {reminderStatus.text}
                </DetailRow>
              ) : null}
              <DetailRow label="Terminart">{appointment.type || 'Regeltermin'}</DetailRow>
              <DetailRow label="Status" valueClassName="text-primary">
                {appointment.status || 'Bestätigt'}
              </DetailRow>
              {appointment.created_at ? (
                <DetailRow label="Erstellt am">{formatGermanDate(appointment.created_at)}</DetailRow>
              ) : null}
            </div>
          </SectionCard>

          {pastAppointments.length > 0 ? (
            <SectionCard title={<SectionTitle icon="bi-clock-history">Terminverlauf</SectionTitle>}>
              <div className="space-y-3 px-[22px] py-4">
                {pastAppointments.map((past) => {
                  const isCurrent = past.id === id
                  return (
                    <div key={past.id} className="flex gap-3">
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          isCurrent ? 'bg-[var(--accent)]' : 'bg-[#D1D5DB]'
                        }`}
                      />
                      <div className="text-[13px] leading-snug">
                        <strong className="font-semibold text-[#1B1F23]">
                          {past.appointment_date ? formatGermanDate(past.appointment_date) : '–'}
                        </strong>
                        {isCurrent ? ' — Aktueller Termin' : ''}
                        <div className="text-[12px] text-[#6B7280]">
                          {past.type || 'Regeltermin'} · {past.status || 'Bestätigt'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </AppPage>
  )
}
