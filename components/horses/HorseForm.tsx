'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import TimePicker from '@/components/form/TimePicker'
import { formatCustomerNumber } from '@/lib/format'
import AddressAutocomplete, { type AddressSuggestion } from '@/components/customers/AddressAutocomplete'
import DeleteHorseForm from '@/app/(app)/horses/[id]/DeleteHorseForm'
import { HorseIcon } from '@/components/icons/HorseIcon'
import { localDateTimeToUtcIso } from '@/lib/datetime/localDateTime'
import { DACH_FORM_COUNTRIES, dachLandSelectLabel } from '@/lib/dachCountryFlags'

type HorseFormMode = 'create' | 'edit'

export type HorseFormCustomerOption = {
  id: string
  customer_number?: number | null
  name: string | null
}

export type HorseFormInitialData = {
  id?: string
  customerId: string
  name: string
  breed: string
  sex: string
  birthYear: string
  birthDate: string
  usage: string
  housing: string
  hoofStatus: string
  careInterval: string
  specialNotes: string
  notes: string

  stableName: string
  stableStreet: string
  stableZip: string
  stableCity: string
  stableCountry: string
  stableContact: string
  stablePhone: string
  stableDirections: string
  /** Nur Bearbeiten: gespeicherter Entfernungstext zum Standort */
  stableDriveTime?: string | null
}

type HorseFormProps = {
  mode: HorseFormMode
  customers: HorseFormCustomerOption[]
  initialData: HorseFormInitialData
  deleteAction?: () => void | Promise<void>
  deleteLabel?: string
  deleteConfirmText?: string
}


function Section({
  title,
  icon,
  badge,
  opt,
  children,
}: {
  title: string
  icon: React.ReactNode
  badge?: string
  opt?: string
  children: React.ReactNode
}) {
  return (
    <section className="huf-card">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-6 py-[18px]">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-light)] text-[14px] text-[var(--accent)]">
          {icon}
        </span>
        <h3 className="dashboard-serif flex-1 text-[16px] font-medium text-[#1B1F23]">
          {title}
        </h3>

        {badge && (
          <span className="rounded-full bg-[var(--accent-light)] px-3 py-1 text-[11px] font-medium text-[var(--accent-dark)]">
            {badge}
          </span>
        )}

        {opt && <span className="text-[11px] text-[#9CA3AF]">{opt}</span>}
      </div>

      <div className="min-w-0 space-y-5 p-6">{children}</div>
    </section>
  )
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="form-group">
      <label className={`form-label${required ? ' form-label--required' : ''}`}>{label}</label>
      {children}
      {hint && <div className="form-helper">{hint}</div>}
    </div>
  )
}

function InfoBanner({
  type = 'tip',
  title,
  children,
}: {
  type?: 'tip' | 'warn'
  title: string
  children: React.ReactNode
}) {
  const classes =
    type === 'warn'
      ? 'border-[#FDE68A] bg-[#FEF9EE] text-[#92400E]'
      : 'border-[var(--border)] bg-[var(--accent-light)] text-[var(--accent-dark)]'

  return (
    <div className={`flex items-start gap-3 rounded-[10px] border px-4 py-3 text-[13px] leading-6 ${classes}`}>
      <span className="mt-0.5 text-[16px]">{type === 'warn' ? '⚠️' : 'ℹ️'}</span>
      <div>
        <strong>{title}</strong> {children}
      </div>
    </div>
  )
}

const usageOptions = [
  'Freizeit / Gelände',
  'Dressur',
  'Springen',
  'Vielseitigkeit',
  'Western',
  'Gangpferd / Tölt',
  'Zucht',
  'Ausbildung / Jungpferd',
  'Kinder / Anfänger',
  'Therapeutisches Reiten',
  'Kutsche / Fahren',
  'Rentner / nicht genutzt',
  'Reha / Aufbau',
  'Sport Dressur',
  'Sport Springen',
  'Jungpferd / Ausbildung',
  'Sonstiges',
]

const housingOptions = [
  'Boxenhaltung',
  'Box',
  'Box mit Paddock',
  'Offenstall',
  'Offenstall / Laufstall',
  'Paddock Trail',
  'Weidehaltung',
  'Aktivstall',
  'Robusthaltung',
  'Sonstiges',
]

const hoofStatusOptions = [
  'Barhuf',
  'Barhuf (unbeschlagen)',
  'Eisen vorne',
  'Eisen hinten',
  'Komplett beschlagen',
  'Hufeisen (Stahl)',
  'Hufeisen (Aluminium)',
  'Kunststoffbeschlag',
  'Kunststoffbeschlag (geklebt)',
  'Kunststoffbeschlag (genagelt)',
  'Hufschuhe',
  'Kombination',
]

const careIntervalOptions = [
  '4 Wochen',
  '5 Wochen',
  '6 Wochen',
  '7 Wochen',
  '8 Wochen',
  'Individuell',
  'Individuell nach Bedarf',
]

const breedOptions = [
  'Haflinger',
  'Isländer',
  'Fjordpferd',
  'Welsh Cob',
  'Oldenburger',
  'Trakehner',
  'Hannoveraner',
  'Westfale',
  'Holsteiner',
  'Quarter Horse',
  'Paint Horse',
  'Araber',
  'Warmblut',
  'Dt. Reitpony',
  'Shetlandpony',
  'Friese',
  'Tinker',
  'Andalusier',
  'Lusitano',
  'Appaloosa',
  'Knabstrupper',
  'Noriker',
  'Schwarzwälder Fuchs',
  'Kaltblut',
  'Vollblut',
  'Maultier',
  'Esel',
]

type StableRow = {
  stable_name?: string | null
  stable_street?: string | null
  stable_zip?: string | null
  stable_city?: string | null
  stable_country?: string | null
  stable_contact?: string | null
  stable_phone?: string | null
  stable_directions?: string | null
  stable_drive_time?: string | null
}

function horseRowHasStableLocation(row: StableRow | null | undefined): boolean {
  if (!row) return false
  return !!(
    row.stable_name?.trim() ||
    row.stable_street?.trim() ||
    row.stable_zip?.trim() ||
    row.stable_city?.trim() ||
    row.stable_country?.trim() ||
    row.stable_contact?.trim() ||
    row.stable_phone?.trim() ||
    row.stable_directions?.trim() ||
    (row.stable_drive_time != null && String(row.stable_drive_time).trim() !== '')
  )
}

function initialHorseHasStableLocation(d: HorseFormInitialData): boolean {
  return !!(
    d.stableName?.trim() ||
    d.stableStreet?.trim() ||
    d.stableZip?.trim() ||
    d.stableCity?.trim() ||
    d.stableContact?.trim() ||
    d.stablePhone?.trim() ||
    d.stableDirections?.trim() ||
    (d.stableDriveTime != null && String(d.stableDriveTime).trim() !== '') ||
    (d.stableCountry?.trim() && d.stableCountry.trim() !== 'Deutschland')
  )
}

export default function HorseForm({
  mode,
  customers,
  initialData,
  deleteAction,
  deleteLabel,
  deleteConfirmText,
}: HorseFormProps) {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [customerId, setCustomerId] = useState(initialData.customerId)
  const [name, setName] = useState(initialData.name)
  const [breed, setBreed] = useState(initialData.breed)
  const [sex, setSex] = useState(initialData.sex)
  const [birthYear, setBirthYear] = useState(initialData.birthYear)
  const [birthDate, setBirthDate] = useState(initialData.birthDate)
  const [usage, setUsage] = useState(initialData.usage)
  const [housing, setHousing] = useState(initialData.housing)
  const [hoofStatus, setHoofStatus] = useState(initialData.hoofStatus)
  const [careInterval, setCareInterval] = useState(initialData.careInterval)
  const [specialNotes, setSpecialNotes] = useState(initialData.specialNotes)
  const [notes, setNotes] = useState(initialData.notes)

  const [stableName, setStableName] = useState(initialData.stableName)
  const [stableStreet, setStableStreet] = useState(initialData.stableStreet)
  const [stableZip, setStableZip] = useState(initialData.stableZip)
  const [stableCity, setStableCity] = useState(initialData.stableCity)
  const [stableCountry, setStableCountry] = useState(initialData.stableCountry)
  const [stableContact, setStableContact] = useState(initialData.stableContact)
  const [stablePhone, setStablePhone] = useState(initialData.stablePhone)
  const [stableDirections, setStableDirections] = useState(initialData.stableDirections)
  const [stableDistanceText, setStableDistanceText] = useState<string | null>(
    initialData.stableDriveTime ?? null
  )

  const [stableDiffersFromCustomer, setStableDiffersFromCustomer] = useState(
    () => mode === 'edit' && initialHorseHasStableLocation(initialData)
  )

  const latestCustomerIdRef = useRef(customerId)
  latestCustomerIdRef.current = customerId

  const [planFirstAppointment, setPlanFirstAppointment] = useState(false)
  const [firstAppointmentDate, setFirstAppointmentDate] = useState('')
  const [firstAppointmentTime, setFirstAppointmentTime] = useState('09:00')

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === customerId) || null,
    [customers, customerId]
  )

  async function fetchDistanceFromOrigin(destLat: number, destLon: number): Promise<string | null> {
    try {
      const res = await fetch('/api/user/origin', { credentials: 'include' })
      const origin = await res.json()
      const lat = origin?.lat ?? null
      const lon = origin?.lon ?? null
      if (typeof lat !== 'number' || typeof lon !== 'number') return null
      const params = new URLSearchParams({
        originLon: String(lon),
        originLat: String(lat),
        destLon: String(destLon),
        destLat: String(destLat),
      })
      const routeRes = await fetch(`/api/route-distance?${params}`)
      const data = await routeRes.json()
      const km = data?.distanceKm
      const min = data?.durationMin
      if (typeof km !== 'number') return null
      return min != null ? `Ca. ${km} km, ~${min} Min` : `Ca. ${km} km`
    } catch {
      return null
    }
  }

  function resetStableFields() {
    setStableName('')
    setStableStreet('')
    setStableZip('')
    setStableCity('')
    setStableCountry('Deutschland')
    setStableContact('')
    setStablePhone('')
    setStableDirections('')
    setStableDistanceText(null)
  }

  const applyStableFromRowRef = useRef<(data: StableRow) => void>(() => {})
  applyStableFromRowRef.current = (data: StableRow) => {
    setStableName(data.stable_name ?? '')
    setStableStreet(data.stable_street ?? '')
    setStableZip(data.stable_zip ?? '')
    setStableCity(data.stable_city ?? '')
    setStableCountry(data.stable_country?.trim() || 'Deutschland')
    setStableContact(data.stable_contact ?? '')
    setStablePhone(data.stable_phone ?? '')
    setStableDirections(data.stable_directions ?? '')
    setStableDistanceText(data.stable_drive_time ?? null)
  }

  /** Neues Pferd: Kunde → wenn ein anderes Pferd schon Stall hat, Schalter an + Felder. */
  useEffect(() => {
    if (mode !== 'create') return
    if (!customerId) {
      setStableDiffersFromCustomer(false)
      resetStableFields()
      return
    }
    const cid = customerId
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('horses')
        .select(
          'stable_name, stable_street, stable_zip, stable_city, stable_country, stable_contact, stable_phone, stable_directions, stable_drive_time'
        )
        .eq('customer_id', cid)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled || latestCustomerIdRef.current !== cid) return
      if (error || !data || !horseRowHasStableLocation(data)) {
        setStableDiffersFromCustomer(false)
        resetStableFields()
        return
      }
      setStableDiffersFromCustomer(true)
      applyStableFromRowRef.current(data)
    })()
    return () => {
      cancelled = true
    }
  }, [customerId, mode])

  /** Schalter an: Stall vom letzten Pferd nachladen (nur Neuanlage). */
  useEffect(() => {
    if (mode !== 'create' || !customerId || !stableDiffersFromCustomer) return
    const cid = customerId
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('horses')
        .select(
          'stable_name, stable_street, stable_zip, stable_city, stable_country, stable_contact, stable_phone, stable_directions, stable_drive_time'
        )
        .eq('customer_id', cid)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled || latestCustomerIdRef.current !== cid) return
      if (error || !data || !horseRowHasStableLocation(data)) {
        resetStableFields()
        return
      }
      applyStableFromRowRef.current(data)
    })()
    return () => {
      cancelled = true
    }
  }, [stableDiffersFromCustomer, customerId, mode])

  const customerInitials = selectedCustomer?.name
    ? selectedCustomer.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase()
    : 'KU'

  async function handleSubmit(intent: 'save' | 'record') {
    setLoading(true)
    setMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('Du bist nicht eingeloggt.')
      setLoading(false)
      router.push('/login')
      return
    }

    if (!customerId) {
      setMessage('Bitte einen Kunden auswählen.')
      setLoading(false)
      return
    }

    if (!name.trim()) {
      setMessage('Bitte den Namen des Pferdes eintragen.')
      setLoading(false)
      return
    }

    if (!sex) {
      setMessage('Bitte das Geschlecht auswählen.')
      setLoading(false)
      return
    }

    if (!usage) {
      setMessage('Bitte eine Nutzungsart auswählen.')
      setLoading(false)
      return
    }

    if (planFirstAppointment && !firstAppointmentDate) {
      setMessage('Bitte ein Datum für den Ersttermin wählen.')
      setLoading(false)
      return
    }

    const payload = {
      user_id: user.id,
      customer_id: customerId,
      name: name.trim(),
      breed: breed.trim() || null,
      sex: sex || null,
      birth_year: birthYear ? Number(birthYear) : null,
      birth_date: birthDate || null,
      usage: usage || null,
      housing: housing || null,
      hoof_status: hoofStatus || null,
      care_interval: careInterval || null,
      special_notes: specialNotes.trim() || null,
      notes: notes.trim() || null,

      ...(stableDiffersFromCustomer
        ? {
            stable_name: stableName.trim() || null,
            stable_street: stableStreet.trim() || null,
            stable_zip: stableZip.trim() || null,
            stable_city: stableCity.trim() || null,
            stable_country: stableCountry || null,
            stable_contact: stableContact.trim() || null,
            stable_phone: stablePhone.trim() || null,
            stable_directions: stableDirections.trim() || null,
            stable_drive_time: stableDistanceText || null,
          }
        : {
            stable_name: null,
            stable_street: null,
            stable_zip: null,
            stable_city: null,
            stable_country: null,
            stable_contact: null,
            stable_phone: null,
            stable_directions: null,
            stable_drive_time: null,
          }),
    }

    if (mode === 'create') {
      const { data, error } = await supabase
        .from('horses')
        .insert([payload])
        .select('id')
        .single()

      if (error || !data) {
        setMessage(`Fehler beim Speichern des Pferdes: ${error?.message || 'Unbekannter Fehler'}`)
        setLoading(false)
        return
      }

      if (planFirstAppointment && firstAppointmentDate) {
        const iso = localDateTimeToUtcIso(
          firstAppointmentDate,
          (firstAppointmentTime || '09:00').trim() || '09:00'
        )

        const { data: appointmentData, error: appointmentError } = await supabase
          .from('appointments')
          .insert([
            {
              user_id: user.id,
              customer_id: customerId,
              appointment_date: iso,
              type: 'Ersttermin',
              status: 'Bestätigt',
              notes: 'Automatisch beim Anlegen des Pferdes erstellt.',
            },
          ])
          .select('id')
          .single()

        if (!appointmentError && appointmentData?.id) {
          await supabase.from('appointment_horses').insert([
            {
              user_id: user.id,
              appointment_id: appointmentData.id,
              horse_id: data.id,
            },
          ])
          try {
            await fetch('/api/email/appointment-confirmed', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ appointmentId: appointmentData.id }),
            })
          } catch {
            // E-Mail optional; Pferd und Termin sind gespeichert
          }
        }
      }

      setLoading(false)

      if (intent === 'record') {
        router.push(`/animals/${data.id}/records/new`)
        router.refresh()
        return
      }

      router.push(`/animals/${data.id}`)
      router.refresh()
      return
    }

    if (!initialData.id) {
      setMessage('Pferdedaten konnten nicht zugeordnet werden.')
      setLoading(false)
      return
    }

    const { error } = await supabase
      .from('horses')
      .update(payload)
      .eq('id', initialData.id)
      .eq('user_id', user.id)

    if (error) {
      setMessage(`Fehler beim Aktualisieren des Pferdes: ${error.message}`)
      setLoading(false)
      return
    }

    setLoading(false)

    if (intent === 'record') {
      router.push(`/animals/${initialData.id}/records/new`)
      router.refresh()
      return
    }

    router.push(`/animals/${initialData.id}`)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <Section title="Besitzer / Kunde zuordnen" icon={<i className="bi bi-person-fill-check" />}>
        <div className="space-y-4">
          <Field label="Kunde" required>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="select"
            >
              <option value="">Bitte wählen</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.customer_number != null ? `${formatCustomerNumber(customer.customer_number)} · ` : ''}{customer.name || '-'}
                </option>
              ))}
            </select>
          </Field>

          {selectedCustomer && (
            <div className="flex items-center gap-4 rounded-[10px] border-2 border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent-light)_85%,white)] px-[18px] py-[14px]">
              <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-[var(--accent)] text-[14px] font-semibold text-white">
                {customerInitials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-[#1B1F23]">
                  {selectedCustomer.customer_number != null ? `${formatCustomerNumber(selectedCustomer.customer_number)} · ` : ''}{selectedCustomer.name}
                </div>
                <div className="text-[12px] text-[#6B7280]">
                  Kunde ist zugeordnet.
                </div>
              </div>
            </div>
          )}

          <div className="text-[11px] text-[#9CA3AF]">
            Wird aus dem Kundenkontext übernommen oder kann hier manuell gewählt werden.
          </div>
        </div>
      </Section>

      <Section title="Stammdaten" icon={<HorseIcon className="h-[14px] w-[14px]" />}>
        <div className="grid min-w-0 gap-5 md:grid-cols-3">
          <Field label="Name des Pferdes" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              placeholder="z. B. Stella"
              className="input"
            />
          </Field>

          <Field label="Rasse">
            <input
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              type="text"
              list="breed-options"
              placeholder="z. B. Haflinger"
              className="input"
            />
            <datalist id="breed-options">
              {breedOptions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
            <div className="mt-1 text-[11px] text-[#9CA3AF]">
              Tippe und wähle aus der Liste oder gib frei ein
            </div>
          </Field>

          <Field label="Geschlecht" required>
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              className="select"
            >
              <option value="">Bitte wählen</option>
              <option value="Stute">Stute</option>
              <option value="Wallach">Wallach</option>
              <option value="Hengst">Hengst</option>
            </select>
          </Field>
        </div>

        <div className="grid min-w-0 gap-5 md:grid-cols-2">
          <Field label="Geburtsjahr">
            <input
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              type="text"
              placeholder="z. B. 2014"
              className="input"
            />
          </Field>

          <Field label="Geburtsdatum" hint="Optional genauer als Geburtsjahr">
            <input
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              type="date"
              className="input"
            />
          </Field>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card,#ffffff)] px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium text-[var(--foreground,#1B1F23)]">
                Steht das Pferd an einem anderen Standort als die Kundenadresse?
              </p>
              <p className="form-helper mt-1 max-w-[52rem]">
                Die Rechnungsanschrift des Kunden gilt als Standard. Nur aktivieren, wenn du Stall, Anfahrt oder Kontakt vor Ort separat brauchst.
              </p>
            </div>
            <label
              className="toggle shrink-0 sm:mt-0"
              title={stableDiffersFromCustomer ? 'Anderer Standort: ein' : 'Anderer Standort: aus'}
            >
              <input
                type="checkbox"
                role="switch"
                checked={stableDiffersFromCustomer}
                onChange={(e) => {
                  const next = e.target.checked
                  setStableDiffersFromCustomer(next)
                  if (!next) resetStableFields()
                }}
                aria-label="Pferd steht an anderem Standort als die Kundenadresse"
              />
              <span className="toggle__track">
                <span className="toggle__thumb" />
              </span>
            </label>
          </div>
        </div>
      </Section>

      {stableDiffersFromCustomer && (
        <Section title="Stall / Standort" icon={<i className="bi bi-pin-map-fill" />} badge="Arbeitsort dieses Pferdes">
          <Field label="Stalladresse suchen" hint="Ort, Adresse oder Name des Stalls/Hofs – Vorschläge füllen die Felder darunter">
            <AddressAutocomplete
              placeholder="z. B. Am Waldrand 7, 53567 Asbach"
              onSelect={(a: AddressSuggestion) => {
                setStableStreet(a.street)
                setStableZip(a.zip)
                setStableCity(a.city)
                if (a.country) setStableCountry(a.country)
                setStableDistanceText(null)
                if (a.lat != null && a.lon != null) {
                  void fetchDistanceFromOrigin(a.lat, a.lon).then(setStableDistanceText)
                }
              }}
            />
          </Field>
          {stableDistanceText && (
            <p className="text-[13px] text-[var(--accent)]">Entfernung von deinem Betrieb: {stableDistanceText}</p>
          )}
          <Field label="Name des Stalls / Hofs" hint="So findest du den Standort schnell wieder">
            <input
              value={stableName}
              onChange={(e) => setStableName(e.target.value)}
              type="text"
              placeholder="z. B. Reiterhof Sonnental"
              className="input"
            />
          </Field>
          <Field label="Straße & Hausnummer">
            <input
              value={stableStreet}
              onChange={(e) => setStableStreet(e.target.value)}
              type="text"
              placeholder="z. B. Am Waldrand 7"
              className="input"
            />
          </Field>
          <div className="grid min-w-0 gap-5 md:grid-cols-[2fr_1fr_1fr]">
            <Field label="Ort">
              <input
                value={stableCity}
                onChange={(e) => setStableCity(e.target.value)}
                type="text"
                placeholder="z. B. Asbach"
                className="input"
              />
            </Field>
            <Field label="PLZ">
              <input
                value={stableZip}
                onChange={(e) => setStableZip(e.target.value)}
                type="text"
                placeholder="z. B. 53567"
                className="input"
              />
            </Field>
            <Field label="Land">
              <select
                value={stableCountry}
                onChange={(e) => setStableCountry(e.target.value)}
                className="select"
              >
                {DACH_FORM_COUNTRIES.map(({ iso, value: land }) => (
                  <option key={land} value={land}>
                    {dachLandSelectLabel(iso, land)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid min-w-0 gap-5 md:grid-cols-2">
            <Field label="Ansprechpartner vor Ort" hint="Optional">
              <input
                value={stableContact}
                onChange={(e) => setStableContact(e.target.value)}
                type="text"
                placeholder="z. B. Stallbesitzer Hans Müller"
                className="input"
              />
            </Field>
            <Field label="Telefon vor Ort" hint="Stalltelefon oder Ansprechpartner-Handy">
              <input
                value={stablePhone}
                onChange={(e) => setStablePhone(e.target.value)}
                type="tel"
                placeholder="z. B. 02683 1234"
                className="input"
              />
            </Field>
          </div>
          <Field label="Anfahrtshinweis" hint="Besondere Hinweise zur Anfahrt zum Standort">
            <input
              value={stableDirections}
              onChange={(e) => setStableDirections(e.target.value)}
              type="text"
              placeholder="z. B. Hofeinfahrt links, hinter Scheune"
              className="input"
            />
          </Field>
        </Section>
      )}

      <Section title="Nutzung & Haltung" icon={<HorseIcon className="h-[14px] w-[14px]" />}>
        <div className="grid min-w-0 gap-5 md:grid-cols-2">
          <Field label="Nutzungsart" required>
            <select
              value={usage}
              onChange={(e) => setUsage(e.target.value)}
              className="select"
            >
              <option value="">Bitte wählen</option>
              {usageOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Haltungsform">
            <select
              value={housing}
              onChange={(e) => setHousing(e.target.value)}
              className="select"
            >
              <option value="">Bitte wählen</option>
              {housingOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Hufstatus & Beschlagshistorie" icon={<i className="bi bi-clipboard2-pulse" />} badge="Kernbereich">
        <div className="grid min-w-0 gap-5 md:grid-cols-2">
          <Field label="Aktueller Beschlag">
            <select
              value={hoofStatus}
              onChange={(e) => setHoofStatus(e.target.value)}
              className="select"
            >
              <option value="">Bitte wählen</option>
              {hoofStatusOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Gewünschtes Bearbeitungsintervall">
            <select
              value={careInterval}
              onChange={(e) => setCareInterval(e.target.value)}
              className="select"
            >
              <option value="">Bitte wählen</option>
              {careIntervalOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <InfoBanner title="Tipp:">
          Den detaillierten Erstbefund pro Huf kannst du beim ersten Termin in der Dokumentation erfassen — inklusive Fotos mit Markierungen. Hier reicht erstmal eine grobe Einordnung.
        </InfoBanner>

        <Field
          label="Bekannte Hufprobleme / Besonderheiten"
          hint="Wird in der Pferdeakte gespeichert"
        >
          <textarea
            value={specialNotes}
            onChange={(e) => setSpecialNotes(e.target.value)}
            rows={4}
            placeholder="z. B. Zehenrichtung VL nach lateral, frühere Hufrehe, enge Trachten..."
            className="input textarea leading-6"
          />
        </Field>
      </Section>

      <Section title="Interne Notizen" icon={<i className="bi bi-chat-quote-fill" />} opt="Optional">
        <Field label="Notizen zum Pferd">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="z. B. Pferd wurde von Kollegin übernommen. Besitzerin möchte Umstellung auf Barhuf begleiten."
            className="input textarea leading-6"
          />
        </Field>
      </Section>

      {mode === 'create' && (
        <Section title="Ersttermin planen?" icon={<i className="bi bi-calendar-check" />} opt="Optional">
          <label className="toggle toggle--spread cursor-pointer py-2">
            <input
              type="checkbox"
              checked={planFirstAppointment}
              onChange={(e) => setPlanFirstAppointment(e.target.checked)}
              aria-label="Ersttermin direkt einplanen"
            />
            <span className="toggle__track shrink-0">
              <span className="toggle__thumb" />
            </span>
            <span className="toggle__label">
              <span className="block font-medium text-[var(--foreground,#1B1F23)]">Ersttermin direkt einplanen</span>
              <span className="mt-1 block text-[12px] font-normal text-[var(--form-muted,#6B7280)]">
                Erstellt einen Termin als Erstbefund mit Fotodokumentation
              </span>
            </span>
          </label>

          {planFirstAppointment && (
            <div className="space-y-5 border-t border-[var(--border)] pt-5">
              <div className="grid min-w-0 gap-5 md:grid-cols-2">
                <Field label="Datum">
                  <input
                    value={firstAppointmentDate}
                    onChange={(e) => setFirstAppointmentDate(e.target.value)}
                    type="date"
                    className="input"
                  />
                </Field>

                <Field label="Uhrzeit">
                  <TimePicker
                    value={firstAppointmentTime}
                    onChange={setFirstAppointmentTime}
                    className="input"
                  />
                </Field>
              </div>

              <InfoBanner type="warn" title="Hinweis:">
                Beim Ersttermin solltest du unbedingt Ganzkörperfotos und Sohlenfotos aller 4 Hufe erstellen. Plane dafür etwas mehr Zeit ein als bei einem normalen Regeltermin.
              </InfoBanner>
            </div>
          )}
        </Section>
      )}

      {message && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      <div className="flex flex-col gap-3 pt-2 md:flex-row md:items-center md:justify-between">
        <div>
          <Link
            href="/animals"
            className="inline-flex items-center gap-2 px-4 py-3 text-[14px] text-[#6B7280] hover:text-[#1B1F23]"
          >
            ← Abbrechen
          </Link>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          {mode === 'edit' && initialData.id && deleteAction ? (
            <DeleteHorseForm
              action={deleteAction}
              label={deleteLabel ?? 'Pferd löschen'}
              confirmText={
                deleteConfirmText ??
                'Willst du dieses Pferd wirklich löschen? Alle zugehörigen Dokumentationen und Fotos werden ebenfalls entfernt.'
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-5 py-2.5 text-[15px] font-medium text-red-700 transition-colors hover:border-red-300 hover:bg-red-50 sm:py-3"
            />
          ) : null}
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleSubmit('record')}
            className="huf-button huf-button--outline disabled:opacity-60"
          >
            {mode === 'create'
              ? 'Speichern und Dokumentation anlegen'
              : 'Speichern und Dokumentation öffnen'}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => void handleSubmit('save')}
            className="huf-btn-dark inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-8 py-3 text-[15px] font-medium !text-white transition-colors hover:bg-[var(--accent-dark)] hover:!text-white disabled:opacity-60"
          >
            <i className="bi bi-check-lg text-[16px]" />
            {loading
              ? 'Bitte warten...'
              : mode === 'create'
                ? 'Pferd speichern'
                : 'Änderungen speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}