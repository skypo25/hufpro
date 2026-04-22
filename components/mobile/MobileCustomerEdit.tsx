'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAppProfile } from '@/context/AppProfileContext'
import { showCustomerHorseSpecificFields } from '@/lib/appProfile'
import { supabase } from '@/lib/supabase-client'
import { deleteDocumentationRecordsForLegacyHoofIds } from '@/lib/documentation/mirrorDocumentationPhotos'
import { formatCustomerNumber } from '@/lib/format'
import { removeAnimalProfilePhotoFromStorageSafe } from '@/lib/animals/animalProfilePhotoUpload'
import AddressAutocomplete, { type AddressSuggestion } from '@/components/customers/AddressAutocomplete'

// ─── Types ────────────────────────────────────────────────────────────────────

type FormData = {
  salutation: string
  firstName: string
  lastName: string
  phone: string
  phone2: string
  email: string
  preferredContact: string
  company: string
  vatId: string
  billingStreet: string
  billingCity: string
  billingZip: string
  billingCountry: string
  driveTime: string
  preferredDays: string[]
  preferredTime: string
  intervalWeeks: string
  reminderTiming: string
  notes: string
  source: string
}

const EMPTY: FormData = {
  salutation: '', firstName: '', lastName: '',
  phone: '', phone2: '', email: '', preferredContact: '',
  company: '', vatId: '',
  billingStreet: '', billingCity: '', billingZip: '', billingCountry: 'Deutschland',
  driveTime: '',
  preferredDays: [], preferredTime: '', intervalWeeks: '', reminderTiming: '',
  notes: '', source: '',
}

const DAY_OPTIONS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const COUNTRIES = ['Deutschland', 'Österreich', 'Schweiz']

type HorseRow = {
  id: string
  name: string
  meta: string
  hasAppointment: boolean
  appointmentDate: string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MobileCustomerEdit({ customerId }: { customerId: string }) {
  const router = useRouter()
  const { profile } = useAppProfile()
  const showHorseSpecificCustomerFields = showCustomerHorseSpecificFields(profile)
  const [form, setForm] = useState<FormData>(EMPTY)
  const [customerNumber, setCustomerNumber] = useState<number | null>(null)
  const [horses, setHorses] = useState<HorseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deletingHorseId, setDeletingHorseId] = useState<string | null>(null)
  const [error, setError] = useState('')

  // ─── Load ────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('customers').select('*')
      .eq('id', customerId).eq('user_id', user.id).maybeSingle()
    if (!data) return
    setCustomerNumber(data.customer_number ?? null)
    setForm({
      salutation: data.salutation ?? '',
      firstName: data.first_name ?? '',
      lastName: data.last_name ?? '',
      phone: data.phone ?? '',
      phone2: data.phone2 ?? '',
      email: data.email ?? '',
      preferredContact: data.preferred_contact ?? '',
      company: data.company ?? '',
      vatId: data.vat_id ?? '',
      billingStreet: data.street ?? '',
      billingCity: data.city ?? '',
      billingZip: data.postal_code ?? '',
      billingCountry: data.country ?? 'Deutschland',
      driveTime: data.drive_time ?? '',
      preferredDays: Array.isArray(data.preferred_days) ? data.preferred_days : [],
      preferredTime: data.preferred_time ?? '',
      intervalWeeks: data.interval_weeks != null ? String(data.interval_weeks) : '',
      reminderTiming: data.reminder_timing ?? '',
      notes: data.notes ?? '',
      source: data.source ?? '',
    })

    const { data: horseRows } = await supabase
      .from('horses')
      .select('id, name, breed, sex, birth_year, usage')
      .eq('customer_id', customerId)
      .eq('user_id', user.id)
      .order('name', { ascending: true })
    const horseList = horseRows ?? []

    const horseIds = horseList.map(h => h.id)
    const apptDateByHorse = new Map<string, string>()
    if (horseIds.length) {
      const { data: linkData } = await supabase
        .from('appointment_horses')
        .select('horse_id, appointment_id')
        .eq('user_id', user.id)
        .in('horse_id', horseIds)
      const links = (linkData ?? []) as { horse_id: string; appointment_id: string }[]
      const aptIds = [...new Set(links.map(l => l.appointment_id))]
      if (aptIds.length) {
        const { data: apts } = await supabase
          .from('appointments')
          .select('id, appointment_date')
          .eq('user_id', user.id)
          .in('id', aptIds)
        const aptMap = new Map((apts ?? []).filter((a): a is { id: string; appointment_date: string } => !!a.appointment_date).map(a => [a.id, a.appointment_date]))
        const todayStr = new Date().toISOString().slice(0, 10)
        for (const link of links) {
          const dateStr = aptMap.get(link.appointment_id)
          if (!dateStr) continue
          const aptDateStr = dateStr.slice(0, 10)
          if (aptDateStr < todayStr) continue
          const existing = apptDateByHorse.get(link.horse_id)
          if (!existing || existing.slice(0, 10) > aptDateStr) {
            apptDateByHorse.set(link.horse_id, dateStr)
          }
        }
      }
    }

    const horsesWithMeta: HorseRow[] = horseList.map(h => {
      const age = h.birth_year != null ? new Date().getFullYear() - h.birth_year : null
      const meta = [h.breed, h.sex, age != null ? `${age} Jahre` : null, h.usage].filter(Boolean).join(' · ')
      return {
        id: h.id,
        name: h.name || '–',
        meta: meta || '–',
        hasAppointment: apptDateByHorse.has(h.id),
        appointmentDate: apptDateByHorse.get(h.id) ?? null,
      }
    })
    setHorses(horsesWithMeta)
    setLoading(false)
  }, [customerId])

  useEffect(() => { load() }, [load])

  // ─── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.firstName.trim()) { setError('Vorname ist erforderlich.'); return }
    if (!form.lastName.trim()) { setError('Nachname ist erforderlich.'); return }
    if (!form.phone.trim()) { setError('Telefon ist erforderlich.'); return }
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error: dbErr } = await supabase.from('customers').update({
      salutation: form.salutation || null,
      first_name: form.firstName.trim(), last_name: form.lastName.trim(),
      name: `${form.firstName.trim()} ${form.lastName.trim()}`,
      phone: form.phone.trim(), phone2: form.phone2.trim() || null,
      email: form.email.trim() || null, preferred_contact: form.preferredContact || null,
      company: form.company.trim() || null, vat_id: form.vatId.trim() || null,
      street: form.billingStreet.trim() || null, city: form.billingCity.trim() || null,
      postal_code: form.billingZip.trim() || null, country: form.billingCountry || null,
      drive_time: form.driveTime.trim() || null,
      preferred_days: form.preferredDays.length ? form.preferredDays : null,
      preferred_time: form.preferredTime || null,
      interval_weeks:
        showHorseSpecificCustomerFields && form.intervalWeeks
          ? parseInt(form.intervalWeeks, 10)
          : null,
      reminder_timing: form.reminderTiming || null,
      notes: form.notes.trim() || null, source: form.source || null,
    }).eq('id', customerId).eq('user_id', user.id)
    setSaving(false)
    if (dbErr) { setError('Speichern fehlgeschlagen. Bitte erneut versuchen.'); return }
    router.push(`/customers/${customerId}`)
  }

  function set<K extends keyof FormData>(field: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function toggleDay(day: string) {
    set('preferredDays', form.preferredDays.includes(day)
      ? form.preferredDays.filter(d => d !== day)
      : [...form.preferredDays, day]
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: '#f8f8f8' }}>
        <div style={{ fontSize: 14, color: '#9ca3af' }}>Lade Kundendaten…</div>
      </div>
    )
  }

  const customerNumLabel = customerNumber ? formatCustomerNumber(customerNumber) : '–'
  const displayName = [form.firstName, form.lastName].filter(Boolean).join(' ').trim() || 'Kunde'

  async function handleDelete() {
    if (!window.confirm('Willst du diesen Kunden wirklich löschen? Alle zugehörigen Pferde, Hufdokumentationen und Fotos werden ebenfalls entfernt.')) return
    setDeleting(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: horses } = await supabase.from('horses').select('id').eq('customer_id', customerId).eq('user_id', user.id)
    const horseIds = (horses ?? []).map(h => h.id)
    for (const horseId of horseIds) {
      const { data: records } = await supabase.from('hoof_records').select('id').eq('horse_id', horseId).eq('user_id', user.id)
      const recordIds = (records ?? []).map(r => r.id)
      if (recordIds.length) {
        const { data: photos } = await supabase.from('hoof_photos').select('file_path').eq('user_id', user.id).in('hoof_record_id', recordIds)
        const paths = (photos ?? []).map(p => p.file_path).filter((p): p is string => !!p)
        if (paths.length) await supabase.storage.from('hoof-photos').remove(paths)
        await supabase.from('hoof_photos').delete().eq('user_id', user.id).in('hoof_record_id', recordIds)
        await deleteDocumentationRecordsForLegacyHoofIds(supabase, recordIds, user.id)
        await supabase.from('hoof_records').delete().eq('horse_id', horseId).eq('user_id', user.id)
      }
      await removeAnimalProfilePhotoFromStorageSafe(supabase, user.id, horseId)
      await supabase.from('appointment_horses').delete().eq('horse_id', horseId)
    }
    await supabase.from('appointments').delete().eq('customer_id', customerId).eq('user_id', user.id)
    await supabase.from('horses').delete().eq('customer_id', customerId).eq('user_id', user.id)
    const { error: delErr } = await supabase.from('customers').delete().eq('id', customerId).eq('user_id', user.id)
    setDeleting(false)
    if (delErr) { setError('Löschen fehlgeschlagen. Bitte erneut versuchen.'); return }
    router.push('/customers')
  }

  async function handleDeleteHorse(h: HorseRow) {
    setDeletingHorseId(h.id)
    let hasFutureAppointment = false
    let dateStr = ''
    try {
      const res = await fetch(`/api/horses/${h.id}/delete`, { method: 'GET' })
      if (res.ok) {
        const data = await res.json()
        hasFutureAppointment = !!data.hasFutureAppointment
        dateStr = data.appointmentDate
          ? new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(data.appointmentDate))
          : ''
      }
    } finally {
      setDeletingHorseId(null)
    }
    const warn = hasFutureAppointment
      ? dateStr
        ? `Achtung: Es besteht ein Termin am ${dateStr}:\n\n`
        : `Achtung: Es besteht ein Termin:\n\n`
      : ''
    const msg = `${warn}Wirklich löschen? Alle Hufdokumentationen und Fotos werden ebenfalls entfernt.`
    if (!window.confirm(msg)) return
    setDeletingHorseId(h.id)
    setError('')
    const res = await fetch(`/api/horses/${h.id}/delete`, { method: 'DELETE' })
    setDeletingHorseId(null)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Pferd konnte nicht gelöscht werden.')
      return
    }
    setHorses(prev => prev.filter(x => x.id !== h.id))
  }

  return (
    <div className="mce-root">
      {/* Status Bar */}
      <div style={{ height: 'calc(8px + env(safe-area-inset-top, 0px))', background: '#1c2023' }} />

      {/* Dark Header */}
      <header style={{
        background: '#1c2023', color: '#fff',
        padding: '20px 20px 18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h1 style={{ fontFamily: 'var(--font-outfit,"Outfit",sans-serif)', fontSize: 20, fontWeight: 700, color: '#fff', flex: 1, minWidth: 0, margin: 0 }}>
            Kunde bearbeiten
          </h1>
          <button
            type="button"
            onClick={() => router.push(`/customers/${customerId}`)}
            style={{
              width: 36, height: 36, borderRadius: 10, border: 'none',
              background: 'rgba(255,255,255,.1)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
            aria-label="Schließen"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
          <strong style={{ color: '#52b788', fontWeight: 600 }}>{customerNumLabel}</strong>
          {displayName && ` · ${displayName}`}
          {' · '}Änderungen werden direkt auf den bestehenden Kundendatensatz gespeichert
        </div>
      </header>

      {/* Content */}
      <div style={{ padding: '14px 16px 120px' }}>

        {/* ── 1. KONTAKTDATEN ─────────────────────────────────────── */}
        <Sec icon="bi bi-person-fill" title="Kontaktdaten">
          <FGroup>
            <FLabel>Anrede</FLabel>
            <FSelect value={form.salutation} onChange={v => set('salutation', v)}
              options={['', 'Frau', 'Herr', 'Divers']} placeholder="Bitte wählen" />
          </FGroup>

          <FRow>
            <FGroup>
              <FLabel required>Vorname</FLabel>
              <FInput value={form.firstName} onChange={v => set('firstName', v)} placeholder="Vorname" autoComplete="given-name" />
            </FGroup>
            <FGroup>
              <FLabel required>Nachname</FLabel>
              <FInput value={form.lastName} onChange={v => set('lastName', v)} placeholder="Nachname" autoComplete="family-name" />
            </FGroup>
          </FRow>

          <FRow>
            <FGroup>
              <FLabel required>Telefon / Mobil</FLabel>
              <FInput value={form.phone} onChange={v => set('phone', v)} type="tel" placeholder="0171 …" autoComplete="tel" />
              <FHint>Hauptnummer für Terminkommunikation</FHint>
            </FGroup>
            <FGroup>
              <FLabel>Telefon 2</FLabel>
              <FInput value={form.phone2} onChange={v => set('phone2', v)} type="tel" placeholder="z. B. Festnetz" autoComplete="tel" />
              <FHint>Optional – weitere Nummer</FHint>
            </FGroup>
          </FRow>

          <FRow>
            <FGroup>
              <FLabel>E-Mail</FLabel>
              <FInput value={form.email} onChange={v => set('email', v)} type="email" placeholder="name@beispiel.de" autoComplete="email" />
              <FHint>Für Rechnungen, PDFs und Erinnerungen</FHint>
            </FGroup>
            <FGroup>
              <FLabel>Bevorzugter Kontaktweg</FLabel>
              <FSelect value={form.preferredContact} onChange={v => set('preferredContact', v)}
                options={['', 'Telefon / Anruf', 'WhatsApp', 'E-Mail', 'SMS']} placeholder="Bitte wählen" />
            </FGroup>
          </FRow>
        </Sec>

        {/* ── 2. PFERDE ──────────────────────────────────────────── */}
        <Sec icon="bi bi-collection-fill" title={`Pferde (${horses.length})`}>
          {horses.length === 0 ? (
            <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>Noch keine Pferde angelegt.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {horses.map((h) => (
                <div
                  key={h.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 0',
                    borderBottom: '1px solid #f2f2f3',
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(82,183,136,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>🐴</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{h.name}</div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{h.meta}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteHorse(h)}
                    disabled={!!deletingHorseId}
                    aria-label={`${h.name} löschen`}
                    style={{
                      width: 36, height: 36, borderRadius: 8, border: 'none',
                      background: '#fee2e2', color: '#dc2626',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: deletingHorseId ? 'not-allowed' : 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <i className="bi bi-trash-fill" style={{ fontSize: 16 }} aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Sec>

        {/* ── 3. RECHNUNGSANSCHRIFT ───────────────────────────────── */}
        <Sec icon="bi bi-file-text-fill" title="Rechnungsanschrift" hint="Für Rechnungen & Korrespondenz">
          <FGroup>
            <FLabel>Adresse suchen</FLabel>
            <AddressAutocomplete
              onSelect={(s: AddressSuggestion) => {
                set('billingStreet', s.street)
                set('billingCity', s.city)
                set('billingZip', s.zip)
                set('billingCountry', s.country || 'Deutschland')
              }}
              className="mce-autocomplete"
              placeholder="z. B. Hauptstraße 42, 53567 Asbach"
            />
            <FHint>Straße, PLZ, Ort oder Firmenname – Vorschläge füllen die Felder darunter</FHint>
          </FGroup>

          <FGroup>
            <FLabel required>Straße &amp; Hausnummer</FLabel>
            <FInput value={form.billingStreet} onChange={v => set('billingStreet', v)} placeholder="Musterstraße 1" />
          </FGroup>

          <FRow3>
            <FGroup>
              <FLabel required>Ort</FLabel>
              <FInput value={form.billingCity} onChange={v => set('billingCity', v)} placeholder="Stadt" />
            </FGroup>
            <FGroup>
              <FLabel required>PLZ</FLabel>
              <FInput value={form.billingZip} onChange={v => set('billingZip', v)} placeholder="12345" inputMode="numeric" />
            </FGroup>
            <FGroup>
              <FLabel>Land</FLabel>
              <FSelect value={form.billingCountry} onChange={v => set('billingCountry', v)} options={COUNTRIES} />
            </FGroup>
          </FRow3>

          <FRow>
            <FGroup>
              <FLabel>Firma / Betriebsname</FLabel>
              <FInput value={form.company} onChange={v => set('company', v)} placeholder="z. B. Reiterhof GbR" />
              <FHint>Optional – falls Rechnung an Betrieb geht</FHint>
            </FGroup>
            <FGroup>
              <FLabel>USt-IDNr.</FLabel>
              <FInput value={form.vatId} onChange={v => set('vatId', v)} placeholder="DE 123 456 789" />
              <FHint>Nur bei gewerblichen Kunden</FHint>
            </FGroup>
          </FRow>
        </Sec>

        {/* ── 4. TERMINPRÄFERENZEN ───────────────────────────────── */}
        <Sec icon="bi bi-calendar-check-fill" title="Terminpräferenzen">
          <FGroup>
            <FLabel>Bevorzugte Tage</FLabel>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 2 }}>
              {DAY_OPTIONS.map(day => {
                const active = form.preferredDays.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    style={{
                      width: 38, height: 38, borderRadius: 8,
                      border: `1.5px solid ${active ? '#52b788' : '#cdcdd0'}`,
                      background: active ? 'rgba(82,183,136,.08)' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      color: active ? '#52b788' : '#6B7280',
                      fontFamily: 'inherit',
                    }}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
            <FHint>An welchen Wochentagen ist der Kunde am liebsten verfügbar?</FHint>
          </FGroup>

          {showHorseSpecificCustomerFields ? (
            <FRow>
              <FGroup>
                <FLabel>Bevorzugte Uhrzeit</FLabel>
                <FSelect
                  value={form.preferredTime}
                  onChange={(v) => set('preferredTime', v)}
                  options={[
                    '',
                    'Früh (7–10 Uhr)',
                    'Vormittag (10–12 Uhr)',
                    'Mittag (12–14 Uhr)',
                    'Nachmittag (14–17 Uhr)',
                    'Abend (17–19 Uhr)',
                    'Flexibel',
                  ]}
                  placeholder="Bitte wählen"
                />
              </FGroup>
              <FGroup>
                <FLabel>Bearbeitungsintervall</FLabel>
                <FSelect
                  value={form.intervalWeeks}
                  onChange={(v) => set('intervalWeeks', v)}
                  options={['', '4', '5', '6', '7', '8', '10', '12']}
                  placeholder="Bitte wählen"
                  renderLabel={(v) => (v ? `${v} Wochen` : 'Bitte wählen')}
                />
              </FGroup>
            </FRow>
          ) : (
            <FGroup>
              <FLabel>Bevorzugte Uhrzeit</FLabel>
              <FSelect
                value={form.preferredTime}
                onChange={(v) => set('preferredTime', v)}
                options={[
                  '',
                  'Früh (7–10 Uhr)',
                  'Vormittag (10–12 Uhr)',
                  'Mittag (12–14 Uhr)',
                  'Nachmittag (14–17 Uhr)',
                  'Abend (17–19 Uhr)',
                  'Flexibel',
                ]}
                placeholder="Bitte wählen"
              />
            </FGroup>
          )}

          <FGroup>
            <FLabel>Erinnerung senden</FLabel>
            <FSelect value={form.reminderTiming} onChange={v => set('reminderTiming', v)}
              options={['', '1 Tag vorher', '2 Tage vorher', '3 Tage vorher', '1 Woche vorher']}
              placeholder="Keine Erinnerung" />
          </FGroup>
        </Sec>

        {/* ── 5. NOTIZEN & SONSTIGES ─────────────────────────────── */}
        <Sec icon="bi bi-chat-text-fill" title="Notizen & Sonstiges">
          <FGroup>
            <FLabel>Interne Notizen</FLabel>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="z. B. Kundin wurde empfohlen. Möchte auf Barhuf umstellen."
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
            />
            <FHint>Nur für dich sichtbar</FHint>
          </FGroup>
          <FGroup>
            <FLabel>Wie auf dich aufmerksam geworden?</FLabel>
            <FSelect value={form.source} onChange={v => set('source', v)}
              options={['', 'Empfehlung', 'Google / Internet', 'Social Media', 'Tierarzt', 'Stallgemeinschaft', 'Sonstiges']}
              placeholder="Bitte wählen" />
            <FHint>Hilft dir zu verstehen, welche Kanäle neue Kunden bringen</FHint>
          </FGroup>
        </Sec>

      </div>{/* /content */}

      {/* ── Bottom Bar ─────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(255,255,255,.95)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(0,0,0,.08)',
        padding: '12px 16px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', gap: 10,
      }}>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting || saving}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: 12, borderRadius: 10, border: '1.5px solid #dc2626',
            background: deleting ? '#fca5a5' : '#fff', color: deleting ? '#991b1b' : '#dc2626',
            fontSize: 14, fontWeight: 600, cursor: deleting || saving ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          {deleting ? 'Löschen…' : 'Löschen'}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || deleting}
          style={{
            flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: 12, borderRadius: 10, border: 'none',
            background: saving || deleting ? '#a0cfb8' : '#52b788', color: '#fff',
            fontSize: 14, fontWeight: 700, cursor: saving || deleting ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {saving ? 'Speichern…' : 'Speichern'}
        </button>
      </div>

      {/* Error Toast */}
      {error && (
        <div style={{
          position: 'fixed', bottom: 88, left: 16, right: 16, zIndex: 60,
          background: '#dc2626', color: '#fff', borderRadius: 12,
          padding: '12px 16px', fontSize: 14, fontWeight: 500,
          boxShadow: '0 4px 16px rgba(0,0,0,.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 0 0 12px' }}>✕</button>
        </div>
      )}
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Sec({ icon, title, hint, children }: {
  icon: string; title: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid #f2f2f3',
      boxShadow: '0 1px 3px rgba(0,0,0,.05)', marginBottom: 12, overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '14px 16px', borderBottom: '1px solid #f2f2f3',
      }}>
        <i className={icon} style={{ fontSize: 16, color: '#52b788' }} />
        <h3 style={{ flex: 1, fontSize: 14, fontFamily: 'var(--font-outfit,"Outfit",sans-serif)', fontWeight: 600, color: '#111', margin: 0 }}>
          {title}
        </h3>
        {hint && <span style={{ fontSize: 10, color: '#9CA3AF' }}>{hint}</span>}
      </div>
      <div style={{ padding: '14px 16px' }}>{children}</div>
    </div>
  )
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function FRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>{children}</div>
}

function FRow3({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>{children}</div>
}

function FGroup({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: 14 }}>{children}</div>
}

function FLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5, fontFamily: 'var(--font-dm-sans,"DM Sans",sans-serif)' }}>
      {children}{required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
    </label>
  )
}

function FHint({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3, fontFamily: 'var(--font-dm-sans,"DM Sans",sans-serif)' }}>{children}</div>
}

// ─── Input style constant ─────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 13px',
  border: '1.5px solid #cdcdd0', borderRadius: 10,
  fontSize: 15, fontFamily: 'var(--font-dm-sans,"DM Sans",sans-serif)',
  color: '#111', background: '#fafafa', outline: 'none',
  boxSizing: 'border-box', WebkitAppearance: 'none',
}

function FInput({ value, onChange, placeholder, type = 'text', inputMode, autoComplete }: {
  value: string; onChange: (v: string) => void
  placeholder?: string; type?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  autoComplete?: string
}) {
  return (
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} inputMode={inputMode} autoComplete={autoComplete}
      style={inputStyle}
    />
  )
}

function FSelect({ value, onChange, options, placeholder, renderLabel }: {
  value: string; onChange: (v: string) => void
  options: string[]; placeholder?: string
  renderLabel?: (v: string) => string
}) {
  return (
    <select
      value={value} onChange={e => onChange(e.target.value)}
      style={{
        ...inputStyle,
        fontSize: 'var(--form-control-font-size, 13.5px)',
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239CA3AF' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C%2Fsvg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
        cursor: 'pointer', appearance: 'none' as const,
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.filter(o => o !== '').map(o => (
        <option key={o} value={o}>{renderLabel ? renderLabel(o) : o}</option>
      ))}
    </select>
  )
}
