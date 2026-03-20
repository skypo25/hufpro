'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import { getInitials } from '@/lib/format'

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

type CustomerOption = {
  id: string
  customer_number?: number | null
  name: string | null
}

export default function MobileHorseForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialCustomerId = searchParams.get('customerId') || ''

  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorFields, setErrorFields] = useState<string[]>([])
  const [dbError, setDbError] = useState('')

  const [customerId, setCustomerId] = useState(initialCustomerId)
  const [customerSearch, setCustomerSearch] = useState('')
  const [name, setName] = useState('')
  const [breed, setBreed] = useState('')
  const [sex, setSex] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [usage, setUsage] = useState('')
  const [housing, setHousing] = useState('')
  const [hoofStatus, setHoofStatus] = useState('')
  const [careInterval, setCareInterval] = useState('')
  const [specialNotes, setSpecialNotes] = useState('')
  const [notes, setNotes] = useState('')
  const [planFirstAppointment, setPlanFirstAppointment] = useState(false)
  const [firstAppointmentDate, setFirstAppointmentDate] = useState('')
  const [firstAppointmentTime, setFirstAppointmentTime] = useState('09:00')

  const loadCustomers = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('customers')
      .select('id, customer_number, name')
      .eq('user_id', user.id)
      .order('name', { ascending: true })
    setCustomers(data ?? [])
  }, [])

  useEffect(() => {
    loadCustomers().finally(() => setLoading(false))
  }, [loadCustomers])

  useEffect(() => {
    if (initialCustomerId) setCustomerId(initialCustomerId)
  }, [initialCustomerId])

  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase()
    let list = customers
    if (term) {
      list = customers.filter((c) => {
        const haystack = (c.name || '').toLowerCase()
        return haystack.includes(term)
      })
    }
    return list.slice(0, 30)
  }, [customers, customerSearch])

  const selectedCustomer = customers.find((c) => c.id === customerId) || null

  const FIELD_LABELS: Record<string, string> = {
    customerId: 'Kunde',
    name: 'Name',
    sex: 'Geschlecht',
    usage: 'Nutzungsart',
    firstAppointmentDate: 'Ersttermin-Datum',
  }

  async function handleSubmit(intent: 'save' | 'record') {
    setSaving(true)
    setErrorFields([])
    setDbError('')

    try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      setDbError('Du bist nicht eingeloggt.')
      setSaving(false)
      router.push('/login')
      return
    }

    const missing: string[] = []
    if (!customerId) missing.push('customerId')
    if (!name.trim()) missing.push('name')
    if (!sex) missing.push('sex')
    if (!usage) missing.push('usage')
    if (planFirstAppointment && !firstAppointmentDate) missing.push('firstAppointmentDate')

    if (missing.length > 0) {
      setErrorFields(missing)
      setSaving(false)
      requestAnimationFrame(() => {
        const first = document.querySelector('.mhf-field-error, .mhf-has-error')
        first?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
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

    const { data, error } = await supabase
      .from('horses')
      .insert([payload])
      .select('id')
      .single()

    if (error || !data) {
      setDbError(`Fehler beim Speichern: ${error?.message || 'Unbekannter Fehler'}`)
      setSaving(false)
      return
    }

    if (planFirstAppointment && firstAppointmentDate) {
      const iso = `${firstAppointmentDate}T${firstAppointmentTime || '09:00'}:00`
      const { data: appointmentData } = await supabase
        .from('appointments')
        .insert([{
          user_id: user.id,
          customer_id: customerId,
          appointment_date: iso,
          type: 'Ersttermin',
          status: 'Bestätigt',
          notes: 'Automatisch beim Anlegen des Pferdes erstellt.',
        }])
        .select('id')
        .single()

      if (appointmentData?.id) {
        await supabase.from('appointment_horses').insert([{
          user_id: user.id,
          appointment_id: appointmentData.id,
          horse_id: data.id,
        }])
      }
    }

    setSaving(false)

    if (intent === 'record') {
      router.push(`/horses/${data.id}/records/new`)
      router.refresh()
      return
    }
    router.push(`/horses/${data.id}`)
    router.refresh()
    } catch (err) {
      console.error('MobileHorseForm handleSubmit error:', err)
      setDbError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten.')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mhf-root">
        <div className="status-bar" aria-hidden />
        <header className="mhf-header">
          <div className="mhf-ah-top">
            <div className="mhf-ah-title">Neues Pferd anlegen</div>
          </div>
          <div className="mhf-ah-sub">Laden…</div>
        </header>
        <div className="mhf-content">
          <div className="mhf-loading">Kunden werden geladen…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="mhf-root">
      <div className="status-bar" aria-hidden />
      <header className="mhf-header">
        <div className="mhf-ah-top">
          <div className="mhf-ah-title">Neues Pferd anlegen</div>
          <button
            type="button"
            className="mhf-ah-close"
            onClick={() => router.back()}
            aria-label="Schließen"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="mhf-ah-sub">Pflichtfelder sind mit * gekennzeichnet</div>
      </header>

      <div className="mhf-content">
        {/* 1. Besitzer zuordnen */}
        <section className={`mhf-section ${errorFields.includes('customerId') ? 'mhf-field-error' : ''}`}>
          <div className="mhf-s-header">
            <i className="bi bi-people-fill mhf-s-icon" aria-hidden />
            <h3>Besitzer / Kunde zuordnen</h3>
          </div>
          <div className="mhf-s-body">
            <div className={`mhf-f-group ${errorFields.includes('customerId') ? 'mhf-has-error' : ''}`}>
              <label className="mhf-f-label">Kunde <span className="mhf-req">*</span></label>
              {selectedCustomer ? (
                <div className="mhf-customer-selected">
                  <div className="mhf-cs-avatar">{getInitials(selectedCustomer.name)}</div>
                  <div className="mhf-cs-info">
                    <div className="mhf-cs-name">{selectedCustomer.name || '–'}</div>
                  </div>
                  <button
                    type="button"
                    className="mhf-cs-change"
                    onClick={() => { setCustomerId(''); setCustomerSearch(''); }}
                  >
                    Ändern
                  </button>
                </div>
              ) : (
                <>
                  <div className="mhf-customer-search-wrap">
                    <i className="bi bi-search mhf-customer-search-icon" aria-hidden />
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Kunde suchen…"
                      className="mhf-customer-search-input"
                      autoComplete="off"
                    />
                  </div>
                  <div className="mhf-customer-list">
                    {filteredCustomers.length === 0 ? (
                      <div className="mhf-customer-empty">
                        {customerSearch.trim() ? 'Kein Kunde gefunden.' : 'Tippe zum Suchen.'}
                      </div>
                    ) : (
                      filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="mhf-customer-item"
                          onClick={() => { setCustomerId(c.id); setCustomerSearch(''); setErrorFields((f) => f.filter((x) => x !== 'customerId')); }}
                        >
                          <span className="mhf-ci-avatar">{getInitials(c.name)}</span>
                          <span className="mhf-ci-name">{c.name || '–'}</span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
              <div className="mhf-f-hint">Wird aus dem Kundenkontext übernommen oder kann hier manuell gewählt werden.</div>
            </div>
          </div>
        </section>

        {/* 2. Stammdaten */}
        <section className={`mhf-section ${errorFields.includes('name') || errorFields.includes('sex') ? 'mhf-field-error' : ''}`}>
          <div className="mhf-s-header">
            <i className="bi bi-heart-fill mhf-s-icon" aria-hidden />
            <h3>Stammdaten</h3>
          </div>
          <div className="mhf-s-body">
            <div className="mhf-f-row-3">
              <div className={`mhf-f-group ${errorFields.includes('name') ? 'mhf-has-error' : ''}`}>
                <label className="mhf-f-label">Name <span className="mhf-req">*</span></label>
                <input
                  value={name}
                  onChange={(e) => { setName(e.target.value); setErrorFields((f) => f.filter((x) => x !== 'name')); }}
                  className="mhf-f-input"
                  placeholder="z. B. Stella"
                />
              </div>
              <div className="mhf-f-group">
                <label className="mhf-f-label">Rasse</label>
                <input
                  value={breed}
                  onChange={(e) => setBreed(e.target.value)}
                  list="mhf-breed-options"
                  className="mhf-f-input"
                  placeholder="z. B. Haflinger"
                />
                <datalist id="mhf-breed-options">
                  {breedOptions.map((b) => <option key={b} value={b} />)}
                </datalist>
              </div>
              <div className={`mhf-f-group ${errorFields.includes('sex') ? 'mhf-has-error' : ''}`}>
                <label className="mhf-f-label">Geschlecht <span className="mhf-req">*</span></label>
                <select value={sex} onChange={(e) => { setSex(e.target.value); setErrorFields((f) => f.filter((x) => x !== 'sex')); }} className="mhf-f-select">
                  <option value="">Bitte wählen</option>
                  <option value="Stute">Stute</option>
                  <option value="Hengst">Hengst</option>
                  <option value="Wallach">Wallach</option>
                </select>
              </div>
            </div>
            <div className="mhf-f-row">
              <div className="mhf-f-group">
                <label className="mhf-f-label">Geburtsjahr</label>
                <input
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  className="mhf-f-input"
                  placeholder="z. B. 2014"
                />
              </div>
              <div className="mhf-f-group">
                <label className="mhf-f-label">Geburtsdatum</label>
                <input
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  type="date"
                  className="mhf-f-input"
                />
                <div className="mhf-f-hint">Optional genauer als Geburtsjahr</div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Nutzung & Haltung */}
        <section className={`mhf-section ${errorFields.includes('usage') ? 'mhf-field-error' : ''}`}>
          <div className="mhf-s-header">
            <i className="bi bi-trophy-fill mhf-s-icon" aria-hidden />
            <h3>Nutzung & Haltung</h3>
          </div>
          <div className="mhf-s-body">
            <div className="mhf-f-row">
              <div className={`mhf-f-group ${errorFields.includes('usage') ? 'mhf-has-error' : ''}`}>
                <label className="mhf-f-label">Nutzungsart <span className="mhf-req">*</span></label>
                <select value={usage} onChange={(e) => { setUsage(e.target.value); setErrorFields((f) => f.filter((x) => x !== 'usage')); }} className="mhf-f-select">
                  <option value="">Bitte wählen</option>
                  {usageOptions.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="mhf-f-group">
                <label className="mhf-f-label">Haltungsform</label>
                <select value={housing} onChange={(e) => setHousing(e.target.value)} className="mhf-f-select">
                  <option value="">Bitte wählen</option>
                  {housingOptions.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Hufstatus & Beschlagshistorie */}
        <section className="mhf-section">
          <div className="mhf-s-header">
            <i className="bi bi-clipboard2-pulse-fill mhf-s-icon" aria-hidden />
            <h3>Hufstatus & Beschlagshistorie</h3>
            <span className="mhf-s-hint">Kernbereich</span>
          </div>
          <div className="mhf-s-body">
            <div className="mhf-f-row">
              <div className="mhf-f-group">
                <label className="mhf-f-label">Aktueller Beschlag</label>
                <select value={hoofStatus} onChange={(e) => setHoofStatus(e.target.value)} className="mhf-f-select">
                  <option value="">Bitte wählen</option>
                  {hoofStatusOptions.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="mhf-f-group">
                <label className="mhf-f-label">Bearbeitungsintervall</label>
                <select value={careInterval} onChange={(e) => setCareInterval(e.target.value)} className="mhf-f-select">
                  <option value="">Bitte wählen</option>
                  {careIntervalOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="mhf-tip">
              <i className="bi bi-info-circle-fill" aria-hidden />
              <span><strong>Tipp:</strong> Den detaillierten Erstbefund pro Huf kannst du beim ersten Termin in der Dokumentation erfassen — inklusive Fotos mit Markierungen. Hier reicht erstmal eine grobe Einordnung.</span>
            </div>
            <div className="mhf-f-group">
              <label className="mhf-f-label">Bekannte Hufprobleme / Besonderheiten</label>
              <textarea
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
                className="mhf-f-textarea"
                placeholder="z. B. Zehenrichtung VL nach lateral, frühere Hufrehe, enge Trachten..."
                rows={3}
              />
              <div className="mhf-f-hint">Wird in der Pferdeakte gespeichert</div>
            </div>
          </div>
        </section>

        {/* 5. Interne Notizen */}
        <section className="mhf-section">
          <div className="mhf-s-header">
            <i className="bi bi-chat-dots-fill mhf-s-icon" aria-hidden />
            <h3>Interne Notizen</h3>
            <span className="mhf-s-hint">Optional</span>
          </div>
          <div className="mhf-s-body">
            <div className="mhf-f-group">
              <label className="mhf-f-label">Notizen zum Pferd</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mhf-f-textarea"
                placeholder="z. B. Pferd wurde von Kollegin übernommen. Besitzerin möchte Umstellung auf Barhuf begleiten."
                rows={3}
              />
            </div>
          </div>
        </section>

        {/* 6. Ersttermin */}
        <section className={`mhf-section ${errorFields.includes('firstAppointmentDate') ? 'mhf-field-error' : ''}`}>
          <div className="mhf-s-header">
            <i className="bi bi-calendar-plus-fill mhf-s-icon" aria-hidden />
            <h3>Ersttermin planen?</h3>
            <span className="mhf-s-hint">Optional</span>
          </div>
          <div className="mhf-s-body">
            <div className="mhf-toggle-row">
              <div className="mhf-toggle-info">
                <div className="mhf-toggle-title">Ersttermin direkt einplanen</div>
                <div className="mhf-toggle-sub">Erstellt einen Termin als Erstbefund mit Fotodokumentation</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={planFirstAppointment}
                className={`mhf-toggle-switch ${planFirstAppointment ? 'on' : ''}`}
                onClick={() => setPlanFirstAppointment((p) => !p)}
              />
            </div>
            {planFirstAppointment && (
              <div className="mhf-f-row">
                <div className={`mhf-f-group ${errorFields.includes('firstAppointmentDate') ? 'mhf-has-error' : ''}`}>
                  <label className="mhf-f-label">Datum</label>
                  <input
                    value={firstAppointmentDate}
                    onChange={(e) => { setFirstAppointmentDate(e.target.value); setErrorFields((f) => f.filter((x) => x !== 'firstAppointmentDate')); }}
                    type="date"
                    className="mhf-f-input"
                  />
                </div>
                <div className="mhf-f-group">
                  <label className="mhf-f-label">Uhrzeit</label>
                  <input
                    value={firstAppointmentTime}
                    onChange={(e) => setFirstAppointmentTime(e.target.value)}
                    type="time"
                    className="mhf-f-input"
                  />
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Error Toast */}
      {(errorFields.length > 0 || dbError) && (
        <div className="mhf-error-toast">
          <span>
            {dbError || `Bitte ausfüllen: ${errorFields.map((k) => FIELD_LABELS[k] || k).join(', ')}`}
          </span>
          <button type="button" onClick={() => { setErrorFields([]); setDbError(''); }} className="mhf-error-toast-close" aria-label="Schließen">
            ✕
          </button>
        </div>
      )}

      {/* Bottom Bar */}
      <div className="mhf-bottom-bar">
        <div className="mhf-bb-row">
          <button type="button" className="mhf-bb-cancel" onClick={() => router.back()}>
            ← Abbrechen
          </button>
          <button
            type="button"
            className="mhf-bb-save"
            disabled={saving}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void handleSubmit('save')
            }}
          >
            <i className="bi bi-check-lg" aria-hidden />
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}
