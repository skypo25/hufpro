'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { reserveNextCustomerNumber } from '@/app/(app)/customers/actions'
import { supabase } from '@/lib/supabase-client'
import AddressAutocomplete, { type AddressSuggestion } from './AddressAutocomplete'

const dayOptions = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const countryOptions = ['Deutschland', 'Österreich', 'Schweiz']

type CustomerFormMode = 'create' | 'edit'

export type CustomerFormInitialData = {
  id?: string
  salutation: string
  firstName: string
  lastName: string
  phone: string
  phone2: string
  email: string
  preferredContact: string

  billingStreet: string
  billingCity: string
  billingZip: string
  billingCountry: string
  company: string
  vatId: string

  driveTime: string

  preferredDays: string[]
  preferredTime: string
  intervalWeeks: string
  reminderTiming: string

  notes: string
  source: string
}

type CustomerFormProps = {
  mode: CustomerFormMode
  initialData: CustomerFormInitialData
}

function Section({
  title,
  icon,
  badge,
  children,
}: {
  title: string
  icon: React.ReactNode
  badge?: string
  children: React.ReactNode
}) {
  return (
    <section className="huf-card">
      <div className="flex items-center justify-between border-b border-[#E5E2DC] px-6 py-[18px]">
        <h3 className="dashboard-serif flex items-center gap-3 text-[16px] font-medium text-[#1B1F23]">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#edf3ef] text-[14px] text-[#52b788]">
            {icon}
          </span>
          {title}
        </h3>

        {badge && (
          <span className="rounded-full bg-[#edf3ef] px-3 py-1 text-[11px] font-medium text-[#0f301b]">
            {badge}
          </span>
        )}
      </div>

      <div className="space-y-5 p-6">{children}</div>
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
    <div className="flex flex-col">
      <label className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#6B7280]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <div className="mt-1 text-[11px] text-[#9CA3AF]">{hint}</div>}
    </div>
  )
}

export default function CustomerForm({
  mode,
  initialData,
}: CustomerFormProps) {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [salutation, setSalutation] = useState(initialData.salutation)
  const [firstName, setFirstName] = useState(initialData.firstName)
  const [lastName, setLastName] = useState(initialData.lastName)
  const [phone, setPhone] = useState(initialData.phone)
  const [phone2, setPhone2] = useState(initialData.phone2)
  const [email, setEmail] = useState(initialData.email)
  const [preferredContact, setPreferredContact] = useState(
    initialData.preferredContact
  )

  const [billingStreet, setBillingStreet] = useState(initialData.billingStreet)
  const [billingCity, setBillingCity] = useState(initialData.billingCity)
  const [billingZip, setBillingZip] = useState(initialData.billingZip)
  const [billingCountry, setBillingCountry] = useState(initialData.billingCountry)
  const [company, setCompany] = useState(initialData.company)
  const [vatId, setVatId] = useState(initialData.vatId)

  const [preferredDays, setPreferredDays] = useState<string[]>(
    initialData.preferredDays
  )
  const [preferredTime, setPreferredTime] = useState(initialData.preferredTime)
  const [intervalWeeks, setIntervalWeeks] = useState(initialData.intervalWeeks)
  const [reminderTiming, setReminderTiming] = useState(initialData.reminderTiming)

  const [notes, setNotes] = useState(initialData.notes)
  const [source, setSource] = useState(initialData.source)

  const [addHorseNow, setAddHorseNow] = useState(false)
  const [horseName, setHorseName] = useState('')
  const [horseBreed, setHorseBreed] = useState('')
  const [horseGender, setHorseGender] = useState('')
  const [horseBirthYear, setHorseBirthYear] = useState('')
  const [horseUsage, setHorseUsage] = useState('')
  const [horseShoeing, setHorseShoeing] = useState('Barhuf')
  const [horseSpecialNotes, setHorseSpecialNotes] = useState('')

  const [billingDistanceText, setBillingDistanceText] = useState<string | null>(null)

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

  useEffect(() => {
    if (initialData.driveTime) setBillingDistanceText(initialData.driveTime)
  }, [initialData.driveTime])

  function togglePreferredDay(day: string) {
    setPreferredDays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day]
    )
  }

  async function handleSubmit(intent: 'save' | 'save_and_new') {
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

    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setMessage('Bitte Vorname, Nachname und Telefon ausfüllen.')
      setLoading(false)
      return
    }

    if (!billingStreet.trim() || !billingCity.trim() || !billingZip.trim()) {
      setMessage('Bitte die Rechnungsanschrift vollständig ausfüllen.')
      setLoading(false)
      return
    }

    if (mode === 'create' && addHorseNow && !horseName.trim()) {
      setMessage('Bitte den Namen des ersten Pferdes eintragen oder die Pferdeanlage deaktivieren.')
      setLoading(false)
      return
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()

    const payload = {
      user_id: user.id,
      name: fullName,
      salutation: salutation || null,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone.trim(),
      phone2: phone2.trim() || null,
      email: email.trim() || null,
      preferred_contact: preferredContact || null,

      street: billingStreet.trim(),
      house_number: null,
      city: billingCity.trim(),
      postal_code: billingZip.trim(),
      country: billingCountry || 'Deutschland',

      company: company.trim() || null,
      vat_id: vatId.trim() || null,

      drive_time: billingDistanceText || null,

      preferred_days: preferredDays.length > 0 ? preferredDays : null,
      preferred_time: preferredTime || null,
      interval_weeks: intervalWeeks || null,
      reminder_timing: reminderTiming || null,

      notes: notes.trim() || null,
      source: source || null,
    }

    if (mode === 'create') {
      let reserved = await reserveNextCustomerNumber()
      if ('error' in reserved) {
        setMessage(reserved.error)
        setLoading(false)
        return
      }
      let payloadWithNumber = { ...payload, customer_number: reserved.customerNumber }

      let insertResult = await supabase
        .from('customers')
        .insert([payloadWithNumber])
        .select('id')
        .single()
      let customer = insertResult.data
      let customerError = insertResult.error

      const isDuplicateCustomerNumber =
        customerError?.code === '23505' ||
        (customerError?.message?.includes('customer_number') ?? false)
      if (customerError && isDuplicateCustomerNumber) {
        reserved = await reserveNextCustomerNumber()
        if ('error' in reserved) {
          setMessage(reserved.error)
          setLoading(false)
          return
        }
        payloadWithNumber = { ...payload, customer_number: reserved.customerNumber }
        insertResult = await supabase
          .from('customers')
          .insert([payloadWithNumber])
          .select('id')
          .single()
        customer = insertResult.data
        customerError = insertResult.error
      }

      if (customerError || !customer) {
        setMessage(`Fehler beim Speichern des Kunden: ${customerError?.message || 'Unbekannter Fehler'}`)
        setLoading(false)
        return
      }

      if (addHorseNow && horseName.trim()) {
        const { error: horseError } = await supabase.from('horses').insert([
          {
            user_id: user.id,
            customer_id: customer.id,
            name: horseName.trim(),
            breed: horseBreed.trim() || null,
            sex: horseGender || null,
            birth_year: horseBirthYear ? Number(horseBirthYear) : null,
            usage: horseUsage || null,
            hoof_status: horseShoeing || null,
            special_notes: horseSpecialNotes.trim() || null,
          },
        ])

        if (horseError) {
          setMessage(`Kunde gespeichert, aber Pferd konnte nicht gespeichert werden: ${horseError.message}`)
          setLoading(false)
          return
        }
      }

      setLoading(false)

      if (intent === 'save_and_new') {
        router.push('/customers/new')
        router.refresh()
        return
      }

      router.push(`/customers/${customer.id}`)
      router.refresh()
      return
    }

      if (!initialData.id) {
      setMessage('Kundendaten konnten nicht zugeordnet werden.')
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase
      .from('customers')
      .update(payload)
      .eq('id', initialData.id)
      .eq('user_id', user.id)

    if (updateError) {
      setMessage(`Fehler beim Aktualisieren des Kunden: ${updateError.message}`)
      setLoading(false)
      return
    }

    setLoading(false)
    router.push(`/customers/${initialData.id}`)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <Section title="Kontaktdaten" icon={<i className="bi bi-person-fill-check" />}>
        <div className="grid gap-5 md:grid-cols-3">
          <Field label="Anrede">
            <select
              value={salutation}
              onChange={(e) => setSalutation(e.target.value)}
              className="huf-input"
            >
              <option value="">Bitte wählen</option>
              <option value="Frau">Frau</option>
              <option value="Herr">Herr</option>
              <option value="Divers">Divers</option>
              <option value="Keine Angabe">Keine Angabe</option>
            </select>
          </Field>

          <Field label="Vorname" required>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              type="text"
              placeholder="z. B. Andrea"
              className="huf-input"
            />
          </Field>

          <Field label="Nachname" required>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              type="text"
              placeholder="z. B. Hoffmann"
              className="huf-input"
            />
          </Field>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="Telefon / Mobil"
            required
            hint="Hauptnummer für Terminkommunikation"
          >
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              placeholder="z. B. 0172 123 4567"
              className="huf-input"
            />
          </Field>

          <Field label="Telefon 2" hint="Optional – weitere Nummer">
            <input
              value={phone2}
              onChange={(e) => setPhone2(e.target.value)}
              type="tel"
              placeholder="z. B. Festnetz"
              className="huf-input"
            />
          </Field>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="E-Mail"
            hint="Für Rechnungen, PDF-Berichte und Erinnerungen"
          >
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="z. B. andrea.hoffmann@email.de"
              className="huf-input"
            />
          </Field>

          <Field label="Bevorzugter Kontaktweg">
            <select
              value={preferredContact}
              onChange={(e) => setPreferredContact(e.target.value)}
              className="huf-input"
            >
              <option>Telefon / Anruf</option>
              <option>WhatsApp</option>
              <option>SMS</option>
              <option>E-Mail</option>
              <option>Signal / Telegram</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Rechnungsanschrift" icon={<i className="bi bi-file-earmark-text-fill" />} badge="Für Rechnungen & Korrespondenz">
        <Field label="Adresse suchen" hint="Straße, PLZ, Ort oder Firmenname (z. B. Reiterhof) – Vorschläge füllen die Felder darunter">
          <AddressAutocomplete
            placeholder="z. B. Hauptstraße 42, 53567 Asbach"
            onSelect={(a: AddressSuggestion) => {
              setBillingStreet(a.street)
              setBillingZip(a.zip)
              setBillingCity(a.city)
              if (a.country) setBillingCountry(a.country)
              setBillingDistanceText(null)
              if (a.lat != null && a.lon != null) {
                fetchDistanceFromOrigin(a.lat, a.lon).then(setBillingDistanceText)
              }
            }}
          />
        </Field>
        {billingDistanceText && (
          <p className="text-[13px] text-[#52b788]">Entfernung von deinem Betrieb: {billingDistanceText}</p>
        )}
        <div className="grid gap-5">
          <Field label="Straße & Hausnummer" required>
            <input
              value={billingStreet}
              onChange={(e) => setBillingStreet(e.target.value)}
              type="text"
              placeholder="z. B. Hauptstraße 42"
              className="huf-input"
            />
          </Field>
        </div>

        <div className="grid gap-5 md:grid-cols-[2fr_1fr_1fr]">
          <Field label="Ort" required>
            <input
              value={billingCity}
              onChange={(e) => setBillingCity(e.target.value)}
              type="text"
              placeholder="z. B. Asbach"
              className="huf-input"
            />
          </Field>

          <Field label="PLZ" required>
            <input
              value={billingZip}
              onChange={(e) => setBillingZip(e.target.value)}
              type="text"
              placeholder="z. B. 53567"
              className="huf-input"
            />
          </Field>

          <Field label="Land">
            <select
              value={billingCountry}
              onChange={(e) => setBillingCountry(e.target.value)}
              className="huf-input"
            >
              {countryOptions.map((country) => (
                <option key={country}>{country}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="Firma / Betriebsname"
            hint="Optional – falls die Rechnung an einen Betrieb geht"
          >
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              type="text"
              placeholder="z. B. Reiterhof Hoffmann GbR"
              className="huf-input"
            />
          </Field>

          <Field label="USt-IdNr." hint="Nur bei gewerblichen Kunden">
            <input
              value={vatId}
              onChange={(e) => setVatId(e.target.value)}
              type="text"
              placeholder="z. B. DE123456789"
              className="huf-input"
            />
          </Field>
        </div>
      </Section>

      <Section title="Terminpräferenzen" icon={<i className="bi bi-calendar3" />}>
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="Bevorzugte Tage"
            hint="An welchen Wochentagen ist der Kunde am liebsten verfügbar?"
          >
            <div className="flex flex-wrap gap-2">
              {dayOptions.map((day) => {
                const active = preferredDays.includes(day)

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => togglePreferredDay(day)}
                    className={[
                      'rounded-lg border px-3 py-2 text-[12px] font-medium transition',
                      active
                        ? 'border-[#52b788] bg-[#edf3ef] text-[#0f301b]'
                        : 'border-[#E5E2DC] bg-white text-[#6B7280] hover:border-[#52b788]',
                    ].join(' ')}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </Field>

          <Field label="Bevorzugte Uhrzeit">
            <select
              value={preferredTime}
              onChange={(e) => setPreferredTime(e.target.value)}
              className="huf-input"
            >
              <option>Keine Präferenz</option>
              <option>Vormittags (8–12 Uhr)</option>
              <option>Nachmittags (12–17 Uhr)</option>
              <option>Flexibel</option>
            </select>
          </Field>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Bearbeitungsintervall">
            <select
              value={intervalWeeks}
              onChange={(e) => setIntervalWeeks(e.target.value)}
              className="huf-input"
            >
              <option>4 Wochen</option>
              <option>5 Wochen</option>
              <option>6 Wochen</option>
              <option>7 Wochen</option>
              <option>8 Wochen</option>
              <option>Individuell</option>
            </select>
          </Field>

          <Field label="Erinnerung senden">
            <select
              value={reminderTiming}
              onChange={(e) => setReminderTiming(e.target.value)}
              className="huf-input"
            >
              <option>1 Tag vorher</option>
              <option>3 Tage vorher</option>
              <option>1 Woche vorher</option>
              <option>Keine Erinnerung</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Notizen & Sonstiges" icon={<i className="bi bi-chat-quote-fill" />}>
        <Field
          label="Interne Notizen"
          hint="Nur für dich sichtbar"
        >
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="z. B. Kundin wurde empfohlen. Möchte auf Barhuf umstellen."
            className="huf-input huf-input--multiline leading-6"
          />
        </Field>

        <Field
          label="Wie auf dich aufmerksam geworden?"
          hint="Hilft dir zu verstehen, welche Kanäle neue Kunden bringen"
        >
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="huf-input"
          >
            <option value="">Bitte wählen</option>
            <option>Empfehlung durch bestehenden Kunden</option>
            <option>Facebook / Instagram</option>
            <option>Website / Google</option>
            <option>Ausbildungsschule</option>
            <option>Tierarzt-Empfehlung</option>
            <option>Stallgemeinschaft</option>
            <option>Sonstiges</option>
          </select>
        </Field>
      </Section>

      {mode === 'create' && (
        <Section title="Erstes Pferd direkt anlegen?" icon={<i className="bi bi-plus-circle-fill" />}>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#E5E2DC] px-4 py-3">
            <input
              type="checkbox"
              checked={addHorseNow}
              onChange={(e) => setAddHorseNow(e.target.checked)}
              className="h-4 w-4 accent-[#52b788]"
            />
            <span className="text-[14px] text-[#1B1F23]">
              Optional – du kannst das erste Pferd direkt mit anlegen
            </span>
          </label>

          {addHorseNow && (
            <div className="rounded-xl border border-[#E5E2DC] bg-[rgba(0,0,0,0.01)] p-6">
              <h4 className="mb-4 flex items-center gap-2 text-[14px] font-semibold text-[#1B1F23]">
                <i className="bi bi-plus-circle text-[16px] text-[#52b788]" aria-hidden />
                Pferd 1
              </h4>

              <div className="grid gap-5 md:grid-cols-3">
                <Field label="Name des Pferdes" required>
                  <input
                    value={horseName}
                    onChange={(e) => setHorseName(e.target.value)}
                    type="text"
                    placeholder="z. B. Stella"
                    className="huf-input"
                  />
                </Field>

                <Field label="Rasse">
                  <input
                    value={horseBreed}
                    onChange={(e) => setHorseBreed(e.target.value)}
                    type="text"
                    placeholder="z. B. Haflinger"
                    className="huf-input"
                  />
                </Field>

                <Field label="Geschlecht">
                  <select
                    value={horseGender}
                    onChange={(e) => setHorseGender(e.target.value)}
                    className="huf-input"
                  >
                    <option value="">Bitte wählen</option>
                    <option>Stute</option>
                    <option>Wallach</option>
                    <option>Hengst</option>
                  </select>
                </Field>
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                <Field label="Geburtsjahr">
                  <input
                    value={horseBirthYear}
                    onChange={(e) => setHorseBirthYear(e.target.value)}
                    type="text"
                    placeholder="z. B. 2014"
                    className="huf-input"
                  />
                </Field>

                <Field label="Nutzung">
                  <select
                    value={horseUsage}
                    onChange={(e) => setHorseUsage(e.target.value)}
                    className="huf-input"
                  >
                    <option value="">Bitte wählen</option>
                    <option>Freizeit / Gelände</option>
                    <option>Sport Dressur</option>
                    <option>Sport Springen</option>
                    <option>Rentner / nicht genutzt</option>
                    <option>Reha / Aufbau</option>
                    <option>Jungpferd / Ausbildung</option>
                  </select>
                </Field>

                <Field label="Beschlag / Hufstatus">
                  <select
                    value={horseShoeing}
                    onChange={(e) => setHorseShoeing(e.target.value)}
                    className="huf-input"
                  >
                    <option>Barhuf</option>
                    <option>Eisen vorne</option>
                    <option>Eisen hinten</option>
                    <option>Komplett beschlagen</option>
                    <option>Kunststoffbeschlag</option>
                    <option>Hufschuhe</option>
                  </select>
                </Field>
              </div>

              <Field
                label="Besonderheiten / Hufhistorie"
                hint="Medizinische Hinweise, Hufprobleme, Verhaltensbesonderheiten beim Aufheben etc."
              >
                <textarea
                  value={horseSpecialNotes}
                  onChange={(e) => setHorseSpecialNotes(e.target.value)}
                  rows={3}
                  placeholder="z. B. Wurde früher beschlagen, seit 2023 barhuf."
                  className="huf-input huf-input--multiline leading-6"
                />
              </Field>
            </div>
          )}
        </Section>
      )}

      {message && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      <div className="flex flex-col gap-3 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Link
            href="/customers"
            className="inline-flex items-center gap-2 px-4 py-3 text-[14px] text-[#6B7280] hover:text-[#1B1F23]"
          >
            ← Abbrechen
          </Link>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          {mode === 'create' && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleSubmit('save_and_new')}
              className="inline-flex items-center justify-center rounded-lg border border-[#E5E2DC] px-6 py-3 text-[14px] font-medium text-[#1B1F23] hover:border-[#9CA3AF] disabled:opacity-60"
            >
              Speichern & weiteren Kunden anlegen
            </button>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={() => void handleSubmit('save')}
            className="huf-btn-dark inline-flex items-center justify-center gap-2 rounded-lg bg-[#52b788] px-8 py-3 text-[15px] font-medium text-white hover:bg-[#0f301b] disabled:opacity-60"
          >
            <i className="bi bi-check-lg text-[16px]" />
            {loading
              ? 'Bitte warten...'
              : mode === 'create'
                ? 'Kunden speichern'
                : 'Änderungen speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}