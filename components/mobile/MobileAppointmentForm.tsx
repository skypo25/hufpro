'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { supabase } from '@/lib/supabase-client'
import { useAppProfile } from '@/context/AppProfileContext'
import { animalsNavLabel, animalSingularLabel } from '@/lib/appProfile'
import { animalTypeIconColor, faIconForAnimalType } from '@/lib/animalTypeDisplay'
import AppointmentAnimalsInline from '@/components/appointments/AppointmentAnimalsInline'

/** Tagesübersicht: etwas kleiner als Kalender-Standard (8px) */
const MAF_TAGES_ANIMAL_ICON_CLASS = 'h-[6px] w-[6px] shrink-0'
import { getInitials, formatCustomerNumber } from '@/lib/format'
import { getAppointmentStartEndFromRow } from '@/lib/appointments/appointmentDisplay'
import {
  isoToLocalDateInputValue,
  localDateTimeToUtcIso,
} from '@/lib/datetime/localDateTime'
import {
  APPOINTMENT_DURATION_CHOICES,
  durationLabelToMinutesForWrite,
  getSuggestedDurationLabelMobile,
  minutesToDurationLabelMobile,
} from '@/lib/appointments/appointmentDuration'
import {
  formValueToReminderMinutesBefore,
  reminderOptionsForSelect,
} from '@/lib/appointments/reminderOptions'
import { getDefaultReminderMinutesFromSettings } from '@/lib/appointments/reminderDefaults'

type AppointmentTypeOption = {
  value: 'Regeltermin' | 'Ersttermin' | 'Kontrolle' | 'Sondertermin'
  icon: string
  title: string
  sub: string
}

const DURATION_OPTIONS = APPOINTMENT_DURATION_CHOICES.map((c) => c.labelMobile)

const STATUS_OPTIONS = ['Bestätigt', 'Vorgeschlagen', 'Warteliste'] as const

type CustomerOption = {
  id: string
  customer_number?: number | null
  name: string | null
  phone?: string | null
  street?: string | null
  postal_code?: string | null
  city?: string | null
}

type HorseOption = {
  id: string
  name: string | null
  animal_type?: string | null
  breed?: string | null
  sex?: string | null
  birth_year?: number | null
  customer_id: string | null
  stable_name?: string | null
  stable_city?: string | null
}

type DayItem = {
  id: string
  time: string
  customerName: string
  animals: { name: string; animalType: string | null }[]
  typeLabel: string | null
  typeColor: 'green' | 'orange' | 'blue' | 'purple'
}

function getTypeColor(type: string | null): 'green' | 'orange' | 'blue' | 'purple' {
  const t = (type || '').toLowerCase()
  if (t.includes('erst')) return 'orange'
  if (t.includes('kontroll') || t.includes('nachkontroll')) return 'blue'
  if (t.includes('sonder')) return 'purple'
  return 'green'
}

function formatTime(dateString: string | null) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(date)
}

function formatDayHint(dateStr: string) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(date)
}

function formatDateLong(dateStr: string) {
  if (!dateStr) return '–'
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

type Props = {
  mode: 'create' | 'edit'
  appointmentId?: string
}

export default function MobileAppointmentForm({ mode, appointmentId }: Props) {
  const { profile } = useAppProfile()
  const term = profile.terminology
  const animalsPlural = animalsNavLabel(term)
  const animalSingular = animalSingularLabel(term)

  const appointmentTypeOptions = useMemo<AppointmentTypeOption[]>(
    () => [
      { value: 'Regeltermin', icon: 'bi-repeat', title: 'Regeltermin', sub: 'Routinebearbeitung' },
      {
        value: 'Ersttermin',
        icon: 'bi-stars',
        title: 'Ersttermin',
        sub: term === 'tier' ? 'Neues Tier / Befund' : 'Neues Pferd / Befund',
      },
      { value: 'Kontrolle', icon: 'bi-search', title: 'Kontrolle', sub: 'Nachkontrolle' },
      { value: 'Sondertermin', icon: 'bi-lightning-fill', title: 'Sondertermin', sub: 'Akut / außerplanmäßig' },
    ],
    [term]
  )

  const router = useRouter()
  const searchParams = useSearchParams()
  const initialCustomerId = searchParams.get('customerId') || ''
  const initialHorseId = searchParams.get('horseId') || ''

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [horses, setHorses] = useState<HorseOption[]>([])

  const [customerId, setCustomerId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedHorseIds, setSelectedHorseIds] = useState<string[]>([])
  const [appointmentType, setAppointmentType] =
    useState<AppointmentTypeOption['value']>('Regeltermin')
  const [appointmentDate, setAppointmentDate] = useState('')
  const [appointmentTime, setAppointmentTime] = useState('09:00')
  const [duration, setDuration] = useState('60 min')
  const [status, setStatus] = useState<typeof STATUS_OPTIONS[number]>('Bestätigt')
  const [notes, setNotes] = useState('')
  const [reminderSelect, setReminderSelect] = useState('')
  const [storedReminderForOptions, setStoredReminderForOptions] = useState<
    number | null
  >(null)
  const [editBaseline, setEditBaseline] = useState<{
    appointmentDateRaw: string
    reminder: string
  } | null>(null)
  const [emailRemindersOn, setEmailRemindersOn] = useState(true)

  const reminderOpts = useMemo(
    () => reminderOptionsForSelect(storedReminderForOptions),
    [storedReminderForOptions]
  )

  const [dayItems, setDayItems] = useState<DayItem[]>([])

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [custRes, horseRes] = await Promise.all([
      supabase
        .from('customers')
        .select('id, customer_number, name, phone, street, postal_code, city')
        .eq('user_id', user.id)
        .order('name', { ascending: true }),
      supabase
        .from('horses')
        .select('id, name, animal_type, breed, sex, birth_year, customer_id, stable_name, stable_city')
        .eq('user_id', user.id)
        .order('name', { ascending: true }),
    ])

    setCustomers(custRes.data ?? [])
    setHorses(horseRes.data ?? [])

    const { data: usRow } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', user.id)
      .maybeSingle()
    const st = (usRow?.settings ?? {}) as {
      emailReminders?: boolean
      appointmentReminderDefaultMinutes?: number | null
    }
    setEmailRemindersOn(st.emailReminders !== false)

    if (mode === 'edit' && appointmentId) {
      const { data: apt } = await supabase
        .from('appointments')
        .select('customer_id, appointment_date, type, status, duration_minutes, notes, reminder_minutes_before')
        .eq('id', appointmentId)
        .eq('user_id', user.id)
        .single()

      if (apt) {
        const slot = getAppointmentStartEndFromRow(
          apt.appointment_date,
          apt.duration_minutes
        )
        const aptEnd = slot?.end ?? null
        if (aptEnd && aptEnd.getTime() < Date.now()) {
          router.replace(`/appointments/${appointmentId}`)
          setLoading(false)
          return
        }
        setCustomerId(apt.customer_id || '')
        setAppointmentType((apt.type as AppointmentTypeOption['value']) || 'Regeltermin')
        setAppointmentDate(isoToLocalDateInputValue(apt.appointment_date) || '')
        setAppointmentTime(formatTime(apt.appointment_date) || '09:00')
        setDuration(minutesToDurationLabelMobile(apt.duration_minutes))
        setStatus((apt.status as typeof STATUS_OPTIONS[number]) || 'Bestätigt')
        setNotes(apt.notes || '')
        setStoredReminderForOptions(apt.reminder_minutes_before ?? null)
        setReminderSelect(
          apt.reminder_minutes_before == null
            ? ''
            : String(apt.reminder_minutes_before)
        )
        setEditBaseline({
          appointmentDateRaw: apt.appointment_date || '',
          reminder:
            apt.reminder_minutes_before == null
              ? ''
              : String(apt.reminder_minutes_before),
        })

        const { data: links } = await supabase
          .from('appointment_horses')
          .select('horse_id')
          .eq('appointment_id', appointmentId)
          .eq('user_id', user.id)
        setSelectedHorseIds((links ?? []).map((r) => r.horse_id))
      }
    } else {
      const def = getDefaultReminderMinutesFromSettings(st)
      setStoredReminderForOptions(def)
      setReminderSelect(def == null ? '' : String(def))
      const today = new Date().toISOString().slice(0, 10)
      setAppointmentDate(today)
      let resolvedCustomerId = initialCustomerId
      let resolvedHorseIds: string[] = []
      if (initialHorseId) {
        const horse = (horseRes.data ?? []).find((h) => h.id === initialHorseId)
        if (horse) {
          resolvedHorseIds = [horse.id]
          resolvedCustomerId = horse.customer_id || resolvedCustomerId
        }
      }
      if (!initialHorseId && resolvedCustomerId) {
        const horsesForCust = (horseRes.data ?? []).filter((h) => h.customer_id === resolvedCustomerId)
        if (horsesForCust.length === 1) resolvedHorseIds = [horsesForCust[0].id]
      }
      setCustomerId(resolvedCustomerId)
      setSelectedHorseIds(resolvedHorseIds)
      setDuration(getSuggestedDurationLabelMobile(resolvedHorseIds.length || 1))
    }

    setLoading(false)
  }, [mode, appointmentId, initialCustomerId, initialHorseId])

  useEffect(() => { loadData() }, [loadData])

  const loadDayItems = useCallback(async (dateStr: string) => {
    if (!dateStr) { setDayItems([]); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const dayStart = `${dateStr}T00:00:00`
    const dayEnd = `${dateStr}T23:59:59`

    const { data: apts } = await supabase
      .from('appointments')
      .select('id, appointment_date, customer_id, type')
      .eq('user_id', user.id)
      .gte('appointment_date', dayStart)
      .lte('appointment_date', dayEnd)
      .order('appointment_date', { ascending: true })

    if (!apts?.length) { setDayItems([]); return }

    const aptIds = apts.map((a) => a.id)
    const customerIds = [...new Set(apts.map((a) => a.customer_id).filter(Boolean))] as string[]

    const [{ data: links }, { data: custData }] = await Promise.all([
      supabase.from('appointment_horses').select('appointment_id, horse_id').eq('user_id', user.id).in('appointment_id', aptIds),
      supabase.from('customers').select('id, name').in('id', customerIds),
    ])

    const horseIds = [...new Set((links ?? []).map((l) => l.horse_id))]
    const { data: horseData } = horseIds.length > 0
      ? await supabase.from('horses').select('id, name, animal_type').in('id', horseIds)
      : { data: [] }

    const customersById = new Map((custData ?? []).map((c) => [c.id, c]))
    const horsesById = new Map((horseData ?? []).map((h) => [h.id, h]))
    const animalsByApt = new Map<string, { name: string; animalType: string | null }[]>()
    for (const link of links ?? []) {
      const h = horsesById.get(link.horse_id)
      if (h?.name) {
        const existing = animalsByApt.get(link.appointment_id) ?? []
        animalsByApt.set(link.appointment_id, [
          ...existing,
          { name: h.name, animalType: (h as { animal_type?: string | null }).animal_type ?? null },
        ])
      }
    }

    const items: DayItem[] = apts.map((a) => ({
      id: a.id,
      time: formatTime(a.appointment_date),
      customerName: customersById.get(a.customer_id || '')?.name || 'Unbekannt',
      animals: animalsByApt.get(a.id) ?? [],
      typeLabel: a.type || null,
      typeColor: getTypeColor(a.type),
    }))
    setDayItems(items)
  }, [])

  useEffect(() => {
    if (appointmentDate) loadDayItems(appointmentDate)
    else setDayItems([])
  }, [appointmentDate, loadDayItems])

  const customerHorses = useMemo(() => horses.filter((h) => h.customer_id === customerId), [horses, customerId])
  const selectedCustomer = customers.find((c) => c.id === customerId) || null

  const stallLabel = useMemo(() => {
    const pool =
      selectedHorseIds.length > 0
        ? customerHorses.filter((h) => selectedHorseIds.includes(h.id))
        : customerHorses
    const h = pool.find((x) => x.stable_name?.trim() || x.stable_city?.trim())
    return h?.stable_name?.trim() || h?.stable_city?.trim() || ''
  }, [customerHorses, selectedHorseIds])

  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase()
    let list = customers
    if (term) list = customers.filter((c) => (c.name || '').toLowerCase().includes(term))
    return list.slice(0, 30)
  }, [customers, customerSearch])

  function toggleHorse(horseId: string) {
    setSelectedHorseIds((prev) =>
      prev.includes(horseId) ? prev.filter((id) => id !== horseId) : [...prev, horseId]
    )
  }

  useEffect(() => {
    if (customerHorses.length === 1 && !selectedHorseIds.length) {
      setSelectedHorseIds([customerHorses[0].id])
      setDuration(getSuggestedDurationLabelMobile(1))
    } else if (customerId && selectedHorseIds.length > 0) {
      setDuration(getSuggestedDurationLabelMobile(selectedHorseIds.length))
    }
  }, [customerId, customerHorses.length, selectedHorseIds.length])

  async function handleSubmit(asDraft: boolean) {
    setMessage('')
    setSaving(true)

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      setMessage('Du bist nicht eingeloggt.')
      setSaving(false)
      router.push('/login')
      return
    }

    if (!customerId) {
      setMessage('Bitte wähle einen Kunden.')
      setSaving(false)
      return
    }
    if (selectedHorseIds.length === 0) {
      setMessage(`Bitte wähle mindestens ein ${animalSingular}.`)
      setSaving(false)
      return
    }
    if (!appointmentDate) {
      setMessage('Bitte wähle ein Datum.')
      setSaving(false)
      return
    }
    if (!appointmentTime) {
      setMessage('Bitte wähle eine Uhrzeit.')
      setSaving(false)
      return
    }

    const appointmentDateTime = localDateTimeToUtcIso(appointmentDate, appointmentTime)
    const durationMinutes = durationLabelToMinutesForWrite(duration)
    const prevReminderStored = editBaseline
      ? formValueToReminderMinutesBefore(editBaseline.reminder)
      : null
    const nextReminder =
      mode === 'create'
        ? emailRemindersOn
          ? formValueToReminderMinutesBefore(reminderSelect)
          : null
        : emailRemindersOn
          ? formValueToReminderMinutesBefore(reminderSelect)
          : prevReminderStored
    const finalStatus = asDraft ? 'Vorgeschlagen' : status

    try {
      if (mode === 'create') {
        const { data: apt, error: aptErr } = await supabase
          .from('appointments')
          .insert({
            user_id: user.id,
            customer_id: customerId,
            appointment_date: appointmentDateTime,
            type: appointmentType,
            status: finalStatus,
            duration_minutes: durationMinutes,
            notes: notes.trim() || null,
            reminder_minutes_before: nextReminder,
          })
          .select('id')
          .single()

        if (aptErr || !apt) {
          setMessage(`Fehler: ${aptErr?.message || 'Unbekannt'}`)
          setSaving(false)
          return
        }

        await supabase.from('appointment_horses').insert(
          selectedHorseIds.map((horseId) => ({
            user_id: user.id,
            appointment_id: apt.id,
            horse_id: horseId,
          }))
        )
      } else if (appointmentId) {
        const clearReminderSent =
          !!editBaseline &&
          (new Date(appointmentDateTime).getTime() !==
            new Date(editBaseline.appointmentDateRaw).getTime() ||
            prevReminderStored !== nextReminder)

        const { error: updErr } = await supabase
          .from('appointments')
          .update({
            customer_id: customerId,
            appointment_date: appointmentDateTime,
            type: appointmentType,
            status: finalStatus,
            duration_minutes: durationMinutes,
            notes: notes.trim() || null,
            reminder_minutes_before: nextReminder,
            ...(clearReminderSent
              ? { reminder_email_sent_at: null, reminder_email_error: null }
              : {}),
          })
          .eq('id', appointmentId)
          .eq('user_id', user.id)

        if (updErr) {
          setMessage(`Fehler: ${updErr.message}`)
          setSaving(false)
          return
        }

        await supabase.from('appointment_horses').delete().eq('appointment_id', appointmentId).eq('user_id', user.id)
        await supabase.from('appointment_horses').insert(
          selectedHorseIds.map((horseId) => ({
            user_id: user.id,
            appointment_id: appointmentId,
            horse_id: horseId,
          }))
        )
      }

      setSaving(false)
      router.push('/calendar')
      router.refresh()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Fehler beim Speichern')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mhf-root">
        <div className="status-bar" aria-hidden />
        <header className="mhf-header">
          <div className="mhf-ah-top">
            <div className="mhf-ah-title">{mode === 'edit' ? 'Termin bearbeiten' : 'Neuen Termin anlegen'}</div>
          </div>
          <div className="mhf-ah-sub">Laden…</div>
        </header>
        <div className="mhf-content">
          <div className="mhf-loading">Termin wird geladen…</div>
        </div>
      </div>
    )
  }

  const addressParts = [selectedCustomer?.street, [selectedCustomer?.postal_code, selectedCustomer?.city].filter(Boolean).join(' ')].filter(Boolean)
  const fullAddress = addressParts.join(', ')

  return (
    <div className="mhf-root">
      <div className="status-bar" aria-hidden />
      <header className="mhf-header">
        <div className="mhf-ah-top">
          <div className="mhf-ah-title">{mode === 'edit' ? 'Termin bearbeiten' : 'Neuen Termin anlegen'}</div>
          <button type="button" className="mhf-ah-close" onClick={() => router.back()} aria-label="Schließen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="mhf-ah-sub">{mode === 'edit' ? 'Bestehenden Termin anpassen' : 'Neuen Termin anlegen'}</div>
      </header>

      <div className="mhf-content">
        {/* 1. Kunde */}
        <section className="mhf-section">
          <div className="mhf-s-header">
            <i className="bi bi-person-fill mhf-s-icon" aria-hidden />
            <h3>Kunde auswählen</h3>
          </div>
          <div className="mhf-s-body">
            {selectedCustomer ? (
              <div className="maf-kunde-selected">
                <div className="maf-ks-avatar">{getInitials(selectedCustomer.name)}</div>
                <div className="maf-ks-info">
                  <div className="maf-ks-id">{formatCustomerNumber(selectedCustomer.customer_number)}</div>
                  <div className="maf-ks-name">{selectedCustomer.name || '–'}</div>
                  {stallLabel && <div className="maf-ks-stall">{stallLabel}</div>}
                </div>
                <button type="button" className="maf-ks-change" onClick={() => { setCustomerId(''); setSelectedHorseIds([]); setCustomerSearch(''); }}>Ändern</button>
              </div>
            ) : (
              <>
                <div className="mhf-customer-search-wrap">
                  <i className="bi bi-search mhf-customer-search-icon" aria-hidden />
                  <input type="text" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Kunde suchen…" className="mhf-customer-search-input" autoComplete="off" />
                </div>
                <div className="mhf-customer-list">
                  {filteredCustomers.length === 0 ? (
                    <div className="mhf-customer-empty">{customerSearch.trim() ? 'Kein Kunde gefunden.' : 'Tippe zum Suchen.'}</div>
                  ) : (
                    filteredCustomers.map((c) => (
                      <button key={c.id} type="button" className="mhf-customer-item" onClick={() => { setCustomerId(c.id); setCustomerSearch(''); setSelectedHorseIds([]); }}>
                        <span className="mhf-ci-avatar">{getInitials(c.name)}</span>
                        <span className="mhf-ci-name">{c.name || '–'}</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        {/* 2. Tiere auswählen */}
        <section className="mhf-section">
          <div className="mhf-s-header">
            <i className="bi bi-heart-pulse-fill mhf-s-icon" aria-hidden />
            <h3>{animalsPlural} auswählen</h3>
            {customerHorses.length > 1 && <span className="mhf-s-hint">Mehrfachauswahl möglich</span>}
          </div>
          <div className="mhf-s-body">
            {!customerId ? (
              <div className="maf-empty-hint">Bitte zuerst einen Kunden auswählen.</div>
            ) : customerHorses.length === 0 ? (
              <div className="maf-empty-hint">
                Für diesen Kunden sind keine {animalsPlural.toLowerCase()} vorhanden.
              </div>
            ) : (
              customerHorses.map((horse) => {
                const checked = selectedHorseIds.includes(horse.id)
                const breedStr = [horse.breed, horse.sex, horse.birth_year ? `${horse.birth_year} J.` : null].filter(Boolean).join(' · ')
                return (
                  <button key={horse.id} type="button" className={`maf-pferd-item ${checked ? 'selected' : ''}`} onClick={() => toggleHorse(horse.id)}>
                    <div className="maf-pi-check">{checked ? '✓' : ''}</div>
                    <div className="maf-pi-icon shrink-0" aria-hidden>
                      <FontAwesomeIcon
                        icon={faIconForAnimalType(horse.animal_type)}
                        className="h-3 w-3"
                        style={{ color: animalTypeIconColor }}
                      />
                    </div>
                    <div className="maf-pi-info">
                      <div className="maf-pi-name">{horse.name || '–'}</div>
                      {breedStr && <div className="maf-pi-breed">{breedStr}</div>}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </section>

        {/* 3. Terminart */}
        <section className="mhf-section">
          <div className="mhf-s-header">
            <i className="bi bi-bookmark-fill mhf-s-icon" aria-hidden />
            <h3>Terminart</h3>
          </div>
          <div className="mhf-s-body">
            <div className="maf-terminart-grid">
              {appointmentTypeOptions.map((opt) => (
                <button key={opt.value} type="button" className={`maf-ta-option ${appointmentType === opt.value ? 'selected' : ''}`} onClick={() => setAppointmentType(opt.value)}>
                  <div className="maf-ta-icon"><i className={`bi ${opt.icon}`} aria-hidden /></div>
                  <div className="maf-ta-title">{opt.title}</div>
                  <div className="maf-ta-sub">{opt.sub}</div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 4. Datum & Uhrzeit */}
        <section className="mhf-section">
          <div className="mhf-s-header">
            <i className="bi bi-clock-fill mhf-s-icon" aria-hidden />
            <h3>Datum & Uhrzeit</h3>
          </div>
          <div className="mhf-s-body">
            <div className="maf-datetime-row">
              <div className="mhf-f-group">
                <label className="mhf-f-label">Datum</label>
                <input type="date" value={appointmentDate} onChange={(e) => setAppointmentDate(e.target.value)} className="mhf-f-input" />
              </div>
              <div className="mhf-f-group">
                <label className="mhf-f-label">Uhrzeit</label>
                <input type="time" value={appointmentTime} onChange={(e) => setAppointmentTime(e.target.value)} className="mhf-f-input" />
              </div>
              <div className="mhf-f-group">
                <label className="mhf-f-label">ca. Dauer</label>
                <select value={duration} onChange={(e) => setDuration(e.target.value)} className="mhf-f-select">
                  {DURATION_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="mhf-f-group" style={{ gridColumn: '1 / -1' }}>
                <label className="mhf-f-label">E-Mail-Erinnerung</label>
                <select
                  value={reminderSelect}
                  onChange={(e) => setReminderSelect(e.target.value)}
                  disabled={!emailRemindersOn}
                  className="mhf-f-select disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {reminderOpts.map((o) => (
                    <option
                      key={o.label}
                      value={o.minutes == null ? '' : String(o.minutes)}
                    >
                      {o.label}
                    </option>
                  ))}
                </select>
                <div className="mhf-f-hint">
                  {emailRemindersOn
                    ? 'An Kunden-E-Mail; SMTP unter Benachrichtigungen. Standard dort einstellbar.'
                    : 'Termin-Erinnerungen sind unter Einstellungen → Benachrichtigungen deaktiviert.'}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Tagesübersicht */}
        {appointmentDate && (
          <section className="mhf-section">
            <div className="mhf-s-header">
              <i className="bi bi-calendar-day-fill mhf-s-icon" aria-hidden />
              <h3>Tagesübersicht</h3>
              <span className="mhf-s-hint">{formatDayHint(appointmentDate)}</span>
            </div>
            <div className="mhf-s-body">
              {dayItems.length === 0 ? (
                <div className="maf-empty-hint">Keine Termine an diesem Tag.</div>
              ) : (
                dayItems.map((item) => (
                  <div key={item.id} className="maf-tages-item">
                    <span className="maf-ti-time">{item.time}</span>
                    <div className={`maf-ti-bar ${item.typeColor !== 'green' ? item.typeColor : ''}`} />
                    <div className="maf-ti-info">
                      <div className="maf-ti-name">{item.customerName}</div>
                      <div className="maf-ti-detail flex flex-wrap items-center gap-x-1">
                        {item.animals.length > 0 ? (
                          <>
                            <AppointmentAnimalsInline
                              animals={item.animals}
                              inheritTextStyle
                              iconClassName={MAF_TAGES_ANIMAL_ICON_CLASS}
                            />
                            <span className="text-[#9CA3AF]">·</span>
                          </>
                        ) : null}
                        <span>{item.typeLabel || 'Regeltermin'}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* 6. Notizen */}
        <section className="mhf-section">
          <div className="mhf-s-header">
            <i className="bi bi-chat-text-fill mhf-s-icon" aria-hidden />
            <h3>Notizen</h3>
            <span className="mhf-s-hint">Optional</span>
          </div>
          <div className="mhf-s-body">
            <div className="mhf-f-group">
              <label className="mhf-f-label">Termin-Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as typeof STATUS_OPTIONS[number])} className="mhf-f-select">
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="mhf-f-group">
              <label className="mhf-f-label">Notizen zum Termin</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mhf-f-textarea" placeholder="z. B. Bitte Scoot Boots mitbringen..." rows={3} />
            </div>
            {message && <div className="maf-error-inline">{message}</div>}
          </div>
        </section>

        {/* 7. Zusammenfassung */}
        {selectedCustomer && (
          <section className="mhf-section">
            <div className="mhf-s-header">
              <i className="bi bi-clipboard-check-fill mhf-s-icon" aria-hidden />
              <h3>Zusammenfassung</h3>
            </div>
            <div className="mhf-s-body">
              <div className="maf-zf-row"><span className="maf-zf-label">Kunde</span><span className="maf-zf-value">{selectedCustomer.name || '–'}</span></div>
              {selectedCustomer.phone && <div className="maf-zf-row"><span className="maf-zf-label">Telefon</span><span className="maf-zf-value">{selectedCustomer.phone}</span></div>}
              {(fullAddress || stallLabel) && <div className="maf-zf-row"><span className="maf-zf-label">Stalladresse</span><span className="maf-zf-value">{fullAddress || stallLabel}</span></div>}
              <div className="maf-zf-row">
                <span className="maf-zf-label">{animalsPlural}</span>
                <span className="maf-zf-value link">
                  {customerHorses.filter((h) => selectedHorseIds.includes(h.id)).map((h) => h.name || animalSingular).join(', ') || '–'}
                </span>
              </div>
              <div className="maf-zf-row"><span className="maf-zf-label">Terminart</span><span className="maf-zf-value">{appointmentType}</span></div>
              <div className="maf-zf-row"><span className="maf-zf-label">Datum</span><span className="maf-zf-value">{appointmentDate ? formatDateLong(appointmentDate) : '–'}</span></div>
              <div className="maf-zf-row"><span className="maf-zf-label">Uhrzeit</span><span className="maf-zf-value">{appointmentTime || '–'}</span></div>
              <div className="maf-zf-row"><span className="maf-zf-label">Dauer</span><span className="maf-zf-value">{duration}</span></div>
              <div className="maf-zf-row">
                <span className="maf-zf-label">Erinnerung</span>
                <span className="maf-zf-value">
                  {reminderOpts.find(
                    (o) =>
                      (o.minutes == null ? '' : String(o.minutes)) === reminderSelect
                  )?.label ?? '–'}
                </span>
              </div>
            </div>
          </section>
        )}
      </div>

      <div className="maf-bottom-bar">
        <button type="button" className="maf-bb-cancel" onClick={() => router.back()}>← Abbrechen</button>
        <button type="button" className="maf-bb-save" onClick={() => handleSubmit(false)} disabled={saving}>
          <i className="bi bi-check-lg" aria-hidden />{saving ? 'Wird gespeichert…' : 'Termin speichern'}
        </button>
      </div>
    </div>
  )
}
