'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import TimePicker from '@/components/form/TimePicker'

type HorseFormMode = 'create' | 'edit'

export type HorseFormCustomerOption = {
  id: string
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
}

type HorseFormProps = {
  mode: HorseFormMode
  customers: HorseFormCustomerOption[]
  initialData: HorseFormInitialData
}

const HorseIconSvg = () => (
  <svg width="14" height="14" viewBox="0 0 576 512" fill="currentColor" className="shrink-0" aria-hidden>
    <path d="M448 238.1l0-78.1 16 0 9.8 19.6c12.5 25.1 42.2 36.4 68.3 26 20.5-8.2 33.9-28 33.9-50.1L576 80c0-19.1-8.4-36.3-21.7-48l5.7 0c8.8 0 16-7.2 16-16S568.8 0 560 0L448 0C377.3 0 320 57.3 320 128l-171.2 0C118.1 128 91.2 144.3 76.3 168.8 33.2 174.5 0 211.4 0 256l0 56c0 13.3 10.7 24 24 24s24-10.7 24-24l0-56c0-13.4 6.6-25.2 16.7-32.5 1.6 13 6.3 25.4 13.6 36.4l28.2 42.4c8.3 12.4 6.4 28.7-1.2 41.6-16.5 28-20.6 62.2-10 93.9l17.5 52.4c4.4 13.1 16.6 21.9 30.4 21.9l33.7 0c21.8 0 37.3-21.4 30.4-42.1l-20.8-62.5c-2.1-6.4-.5-13.4 4.3-18.2l12.7-12.7c13.2-13.2 20.6-31.1 20.6-49.7 0-2.3-.1-4.6-.3-6.9l84 24c4.1 1.2 8.2 2.1 12.3 2.8L320 480c0 17.7 14.3 32 32 32l32 0c17.7 0 32-14.3 32-32l0-164.3c19.2-19.2 31.5-45.7 32-75.7l0 0 0-1.9zM496 64a16 16 0 1 1 0 32 16 16 0 1 1 0-32z" />
  </svg>
)

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
      <div className="flex items-center gap-3 border-b border-[#E5E2DC] px-6 py-[18px]">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#edf3ef] text-[14px] text-[#154226]">
          {icon}
        </span>
        <h3 className="dashboard-serif flex-1 text-[16px] font-medium text-[#1B1F23]">
          {title}
        </h3>

        {badge && (
          <span className="rounded-full bg-[#edf3ef] px-3 py-1 text-[11px] font-medium text-[#0f301b]">
            {badge}
          </span>
        )}

        {opt && <span className="text-[11px] text-[#9CA3AF]">{opt}</span>}
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
      <label className="mb-1.5 flex items-center gap-1 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#6B7280]">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <div className="mt-1 text-[11px] text-[#9CA3AF]">{hint}</div>}
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
      : 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1E40AF]'

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

export default function HorseForm({
  mode,
  customers,
  initialData,
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

  const [planFirstAppointment, setPlanFirstAppointment] = useState(false)
  const [firstAppointmentDate, setFirstAppointmentDate] = useState('')
  const [firstAppointmentTime, setFirstAppointmentTime] = useState('09:00')

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === customerId) || null,
    [customers, customerId]
  )

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
        const iso = `${firstAppointmentDate}T${firstAppointmentTime || '09:00'}:00`

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
        }
      }

      setLoading(false)

      if (intent === 'record') {
        router.push(`/horses/${data.id}/records/new`)
        router.refresh()
        return
      }

      router.push(`/horses/${data.id}`)
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
      router.push(`/horses/${initialData.id}/records/new`)
      router.refresh()
      return
    }

    router.push(`/horses/${initialData.id}`)
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
              className="huf-input"
            >
              <option value="">Bitte wählen</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name || '-'}
                </option>
              ))}
            </select>
          </Field>

          {selectedCustomer && (
            <div className="flex items-center gap-4 rounded-[10px] border-2 border-[#154226] bg-[rgba(21,66,38,0.04)] px-[18px] py-[14px]">
              <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-[#154226] text-[14px] font-semibold text-white">
                {customerInitials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-[#1B1F23]">
                  {selectedCustomer.name}
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

      <Section title="Stammdaten" icon={<HorseIconSvg />}>
        <div className="grid gap-5 md:grid-cols-3">
          <Field label="Name des Pferdes" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              placeholder="z. B. Stella"
              className="huf-input"
            />
          </Field>

          <Field label="Rasse">
            <input
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              type="text"
              list="breed-options"
              placeholder="z. B. Haflinger"
              className="huf-input"
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
              className="huf-input"
            >
              <option value="">Bitte wählen</option>
              <option value="Stute">Stute</option>
              <option value="Wallach">Wallach</option>
              <option value="Hengst">Hengst</option>
            </select>
          </Field>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Geburtsjahr">
            <input
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              type="text"
              placeholder="z. B. 2014"
              className="huf-input"
            />
          </Field>

          <Field label="Geburtsdatum" hint="Optional genauer als Geburtsjahr">
            <input
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              type="date"
              className="huf-input"
            />
          </Field>
        </div>
      </Section>

      <Section title="Nutzung & Haltung" icon={<HorseIconSvg />}>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Nutzungsart" required>
            <select
              value={usage}
              onChange={(e) => setUsage(e.target.value)}
              className="huf-input"
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
              className="huf-input"
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
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Aktueller Beschlag">
            <select
              value={hoofStatus}
              onChange={(e) => setHoofStatus(e.target.value)}
              className="huf-input"
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
              className="huf-input"
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
            className="huf-input huf-input--multiline leading-6"
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
            className="huf-input huf-input--multiline leading-6"
          />
        </Field>
      </Section>

      {mode === 'create' && (
        <Section title="Ersttermin planen?" icon={<i className="bi bi-calendar-check" />} opt="Optional">
          <div
            className={[
              'flex cursor-pointer items-center gap-3 py-2',
              planFirstAppointment ? 'on' : '',
            ].join(' ')}
            onClick={() => setPlanFirstAppointment((prev) => !prev)}
          >
            <div className={`relative h-6 w-11 rounded-full transition ${planFirstAppointment ? 'bg-[#154226]' : 'bg-[#E5E2DC]'}`}>
              <div
                className={`absolute top-[2px] h-5 w-5 rounded-full bg-white shadow transition ${planFirstAppointment ? 'left-[22px]' : 'left-[2px]'}`}
              />
            </div>

            <div>
              <div className="text-[14px] font-medium text-[#1B1F23]">
                Ersttermin direkt einplanen
              </div>
              <div className="text-[12px] text-[#6B7280]">
                Erstellt einen Termin als Erstbefund mit Fotodokumentation
              </div>
            </div>
          </div>

          {planFirstAppointment && (
            <div className="space-y-5 border-t border-[#E5E2DC] pt-5">
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Datum">
                  <input
                    value={firstAppointmentDate}
                    onChange={(e) => setFirstAppointmentDate(e.target.value)}
                    type="date"
                    className="huf-input"
                  />
                </Field>

                <Field label="Uhrzeit">
                  <TimePicker
                    value={firstAppointmentTime}
                    onChange={setFirstAppointmentTime}
                    className="huf-input"
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
            href="/horses"
            className="inline-flex items-center gap-2 px-4 py-3 text-[14px] text-[#6B7280] hover:text-[#1B1F23]"
          >
            ← Abbrechen
          </Link>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
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
            className="huf-btn-dark inline-flex items-center justify-center gap-2 rounded-lg bg-[#154226] px-8 py-3 text-[15px] font-medium text-white hover:bg-[#0f301b] disabled:opacity-60"
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