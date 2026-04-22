'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppProfile } from '@/context/AppProfileContext'
import { showCustomerIntervalWeeksPreference } from '@/lib/appProfile'
import { supabase } from '@/lib/supabase-client'
import { reserveNextCustomerNumber } from '@/app/(app)/customers/actions'
import AddressAutocomplete, { type AddressSuggestion } from '@/components/customers/AddressAutocomplete'
import { PREFERRED_CONTACT_OPTIONS } from '@/components/customers/customerFormDefaults'

const COUNTRIES = ['Deutschland', 'Österreich', 'Schweiz']
const DAY_OPTIONS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const PREFERRED_TIME = ['Keine Präferenz', 'Vormittags (8–12 Uhr)', 'Nachmittags (12–17 Uhr)', 'Flexibel']
const INTERVAL_WEEKS = ['4 Wochen', '5 Wochen', '6 Wochen', '7 Wochen', '8 Wochen', 'Individuell']
const REMINDER_TIMING = ['1 Tag vorher', '3 Tage vorher', '1 Woche vorher', 'Keine Erinnerung']
const SOURCE_OPTIONS = [
  '',
  'Empfehlung durch bestehenden Kunden',
  'Facebook / Instagram',
  'Website / Google',
  'Ausbildungsschule',
  'Tierarzt-Empfehlung',
  'Stallgemeinschaft',
  'Sonstiges',
]
const HORSE_USAGE = ['', 'Freizeit / Gelände', 'Sport Dressur', 'Sport Springen', 'Rentner / nicht genutzt', 'Reha / Aufbau', 'Jungpferd / Ausbildung']
const HORSE_SHOEING = ['Barhuf', 'Eisen vorne', 'Eisen hinten', 'Komplett beschlagen', 'Kunststoffbeschlag', 'Hufschuhe']

export default function MobileCustomerForm() {
  const router = useRouter()
  const { profile } = useAppProfile()
  const showIntervalWeeksField = showCustomerIntervalWeeksPreference(profile)
  const [saving, setSaving] = useState(false)
  const [errorFields, setErrorFields] = useState<string[]>([])
  const [dbError, setDbError] = useState('')

  // Kontaktdaten
  const [salutation, setSalutation] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [phone2, setPhone2] = useState('')
  const [email, setEmail] = useState('')
  const [preferredContact, setPreferredContact] = useState('Telefon / Anruf')

  // Rechnungsanschrift
  const [billingStreet, setBillingStreet] = useState('')
  const [billingZip, setBillingZip] = useState('')
  const [billingCity, setBillingCity] = useState('')
  const [billingCountry, setBillingCountry] = useState('Deutschland')
  const [company, setCompany] = useState('')
  const [vatId, setVatId] = useState('')

  // Stall-/Standort (nur wenn erstes Pferd mit angelegt wird → Spalten am Pferd)
  const [stableName, setStableName] = useState('')
  const [stableStreet, setStableStreet] = useState('')
  const [stableZip, setStableZip] = useState('')
  const [stableCity, setStableCity] = useState('')
  const [stableCountry, setStableCountry] = useState('Deutschland')
  const [stableContact, setStableContact] = useState('')
  const [stablePhone, setStablePhone] = useState('')
  const [directions, setDirections] = useState('')

  // Terminpräferenzen
  const [preferredDays, setPreferredDays] = useState<string[]>([])
  const [preferredTime, setPreferredTime] = useState('Vormittags (8–12 Uhr)')
  const [intervalWeeks, setIntervalWeeks] = useState('6 Wochen')
  const [reminderTiming, setReminderTiming] = useState('3 Tage vorher')

  // Notizen & Sonstiges
  const [notes, setNotes] = useState('')
  const [source, setSource] = useState('')

  // Erstes Pferd
  const [addHorseNow, setAddHorseNow] = useState(false)
  const [horseName, setHorseName] = useState('')
  const [horseBreed, setHorseBreed] = useState('')
  const [horseGender, setHorseGender] = useState('')
  const [horseBirthYear, setHorseBirthYear] = useState('')
  const [horseUsage, setHorseUsage] = useState('')
  const [horseShoeing, setHorseShoeing] = useState('Barhuf')
  const [horseSpecialNotes, setHorseSpecialNotes] = useState('')

  const FIELD_LABELS: Record<string, string> = {
    firstName: 'Vorname',
    lastName: 'Nachname',
    phone: 'Telefon',
    billingStreet: 'Straße',
    billingZip: 'PLZ',
    billingCity: 'Ort',
    horseName: 'Name des Pferdes',
  }

  function togglePreferredDay(day: string) {
    setPreferredDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  async function handleSubmit() {
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
      if (!firstName.trim()) missing.push('firstName')
      if (!lastName.trim()) missing.push('lastName')
      if (!phone.trim()) missing.push('phone')
      if (!billingStreet.trim()) missing.push('billingStreet')
      if (!billingZip.trim()) missing.push('billingZip')
      if (!billingCity.trim()) missing.push('billingCity')
      if (addHorseNow && !horseName.trim()) missing.push('horseName')

      if (missing.length > 0) {
        setErrorFields(missing)
        setSaving(false)
        requestAnimationFrame(() => {
          const first = document.querySelector('.mhf-field-error, .mhf-has-error')
          first?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        })
        return
      }

      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()

      const reserved = await reserveNextCustomerNumber()
      if ('error' in reserved) {
        setDbError(reserved.error)
        setSaving(false)
        return
      }

      const payload = {
        user_id: user.id,
        customer_number: reserved.customerNumber,
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
        preferred_days: preferredDays.length > 0 ? preferredDays : null,
        preferred_time: preferredTime || null,
        interval_weeks: showIntervalWeeksField ? intervalWeeks || null : null,
        reminder_timing: reminderTiming || null,
        notes: notes.trim() || null,
        source: source.trim() || null,
      }

      const doInsert = (p: typeof payload & { customer_number: number }) =>
        supabase.from('customers').insert([p]).select('id').single()

      let result = await doInsert({ ...payload, customer_number: reserved.customerNumber })
      let customer = result.data
      let insertError = result.error

      const isDuplicate = insertError?.code === '23505' || insertError?.message?.includes('customer_number')
      if (insertError && isDuplicate) {
        const retry = await reserveNextCustomerNumber()
        if ('error' in retry) {
          setDbError(retry.error)
          setSaving(false)
          return
        }
        result = await doInsert({ ...payload, customer_number: retry.customerNumber })
        customer = result.data
        insertError = result.error
      }

      if (insertError || !customer) {
        setDbError(`Fehler beim Speichern: ${insertError?.message || 'Unbekannter Fehler'}`)
        setSaving(false)
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
            stable_name: stableName.trim() || null,
            stable_street: stableStreet.trim() || null,
            stable_zip: stableZip.trim() || null,
            stable_city: stableCity.trim() || null,
            stable_country: stableCountry || null,
            stable_contact: stableContact.trim() || null,
            stable_phone: stablePhone.trim() || null,
            stable_directions: directions.trim() || null,
          },
        ])
        if (horseError) {
          setDbError(`Kunde gespeichert, aber Pferd konnte nicht angelegt werden: ${horseError.message}`)
          setSaving(false)
          return
        }
      }

      setSaving(false)
      router.push(`/customers/${customer.id}`)
      router.refresh()
    } catch (err) {
      console.error('MobileCustomerForm handleSubmit error:', err)
      setDbError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten.')
      setSaving(false)
    }
  }

  const clearError = (field: string) => () => setErrorFields((f) => f.filter((x) => x !== field))

  return (
    <div className="mhf-root">
      <div className="status-bar" aria-hidden />
      <header className="mhf-header">
        <div className="mhf-ah-top">
          <div className="mhf-ah-title">Neuen Kunden anlegen</div>
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
        {/* 1. Kontaktdaten */}
        <section className={`mhf-section ${errorFields.includes('firstName') || errorFields.includes('lastName') || errorFields.includes('phone') ? 'mhf-field-error' : ''}`}>
          <div className="mhf-s-header">
            <i className="bi bi-person-fill mhf-s-icon" aria-hidden />
            <h3>Kontaktdaten</h3>
          </div>
          <div className="mhf-s-body">
            <div className="mhf-f-group">
              <label className="mhf-f-label">Anrede</label>
              <select value={salutation} onChange={(e) => setSalutation(e.target.value)} className="mhf-f-select">
                <option value="">Bitte wählen</option>
                <option value="Frau">Frau</option>
                <option value="Herr">Herr</option>
                <option value="Divers">Divers</option>
                <option value="Keine Angabe">Keine Angabe</option>
              </select>
            </div>
            <div className="mhf-f-row">
              <div className={`mhf-f-group ${errorFields.includes('firstName') ? 'mhf-has-error' : ''}`}>
                <label className="mhf-f-label">Vorname <span className="mhf-req">*</span></label>
                <input value={firstName} onChange={(e) => { setFirstName(e.target.value); clearError('firstName')(); }} className="mhf-f-input" placeholder="z. B. Anna" />
              </div>
              <div className={`mhf-f-group ${errorFields.includes('lastName') ? 'mhf-has-error' : ''}`}>
                <label className="mhf-f-label">Nachname <span className="mhf-req">*</span></label>
                <input value={lastName} onChange={(e) => { setLastName(e.target.value); clearError('lastName')(); }} className="mhf-f-input" placeholder="z. B. Müller" />
              </div>
            </div>
            <div className={`mhf-f-group ${errorFields.includes('phone') ? 'mhf-has-error' : ''}`}>
              <label className="mhf-f-label">Telefon / Mobil <span className="mhf-req">*</span></label>
              <input value={phone} onChange={(e) => { setPhone(e.target.value); clearError('phone')(); }} className="mhf-f-input" placeholder="z. B. 0172 123 4567" type="tel" />
              <div className="mhf-f-hint">Hauptnummer für Terminkommunikation</div>
            </div>
            <div className="mhf-f-group">
              <label className="mhf-f-label">Telefon 2</label>
              <input value={phone2} onChange={(e) => setPhone2(e.target.value)} className="mhf-f-input" placeholder="z. B. Festnetz" type="tel" />
              <div className="mhf-f-hint">Optional – weitere Nummer</div>
            </div>
            <div className="mhf-f-group">
              <label className="mhf-f-label">E-Mail</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="mhf-f-input" placeholder="z. B. anna@email.de" type="email" />
              <div className="mhf-f-hint">Für Rechnungen, PDF-Berichte und Erinnerungen</div>
            </div>
            <div className="mhf-f-group">
              <label className="mhf-f-label">Bevorzugter Kontaktweg</label>
              <select value={preferredContact} onChange={(e) => setPreferredContact(e.target.value)} className="mhf-f-select">
                {PREFERRED_CONTACT_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* 2. Rechnungsanschrift */}
        <section className={`mhf-section ${errorFields.includes('billingStreet') || errorFields.includes('billingZip') || errorFields.includes('billingCity') ? 'mhf-field-error' : ''}`}>
          <div className="mhf-s-header">
            <i className="bi bi-file-earmark-text-fill mhf-s-icon" aria-hidden />
            <h3>Rechnungsanschrift</h3>
            <span className="mhf-s-hint">Für Rechnungen & Korrespondenz</span>
          </div>
          <div className="mhf-s-body">
            <div className="mhf-f-group">
              <label className="mhf-f-label">Adresse suchen</label>
              <AddressAutocomplete
                placeholder="z. B. Hauptstraße 42, 53567 Asbach"
                onSelect={(a: AddressSuggestion) => {
                  setBillingStreet(a.street)
                  setBillingZip(a.zip)
                  setBillingCity(a.city)
                  if (a.country) setBillingCountry(a.country)
                }}
                className="mhf-f-input"
              />
              <div className="mhf-f-hint">Straße, PLZ, Ort oder Firmenname – Vorschläge füllen die Felder</div>
            </div>
            <div className={`mhf-f-group ${errorFields.includes('billingStreet') ? 'mhf-has-error' : ''}`}>
              <label className="mhf-f-label">Straße & Hausnummer <span className="mhf-req">*</span></label>
              <input value={billingStreet} onChange={(e) => { setBillingStreet(e.target.value); clearError('billingStreet')(); }} className="mhf-f-input" placeholder="z. B. Hauptweg 12" />
            </div>
            <div className="mhf-f-row">
              <div className={`mhf-f-group ${errorFields.includes('billingZip') ? 'mhf-has-error' : ''}`}>
                <label className="mhf-f-label">PLZ <span className="mhf-req">*</span></label>
                <input value={billingZip} onChange={(e) => { setBillingZip(e.target.value); clearError('billingZip')(); }} className="mhf-f-input" placeholder="z. B. 12345" />
              </div>
              <div className={`mhf-f-group ${errorFields.includes('billingCity') ? 'mhf-has-error' : ''}`}>
                <label className="mhf-f-label">Ort <span className="mhf-req">*</span></label>
                <input value={billingCity} onChange={(e) => { setBillingCity(e.target.value); clearError('billingCity')(); }} className="mhf-f-input" placeholder="z. B. Musterstadt" />
              </div>
            </div>
            <div className="mhf-f-group">
              <label className="mhf-f-label">Land</label>
              <select value={billingCountry} onChange={(e) => setBillingCountry(e.target.value)} className="mhf-f-select">
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="mhf-f-group">
              <label className="mhf-f-label">Firma / Betriebsname</label>
              <input value={company} onChange={(e) => setCompany(e.target.value)} className="mhf-f-input" placeholder="z. B. Reiterhof Hoffmann GbR" />
              <div className="mhf-f-hint">Optional – falls die Rechnung an einen Betrieb geht</div>
            </div>
            <div className="mhf-f-group">
              <label className="mhf-f-label">USt-IdNr.</label>
              <input value={vatId} onChange={(e) => setVatId(e.target.value)} className="mhf-f-input" placeholder="z. B. DE123456789" />
              <div className="mhf-f-hint">Nur bei gewerblichen Kunden</div>
            </div>
          </div>
        </section>

        {/* 3. Terminpräferenzen */}
        <section className="mhf-section">
          <div className="mhf-s-header">
            <i className="bi bi-calendar3 mhf-s-icon" aria-hidden />
            <h3>Terminpräferenzen</h3>
          </div>
          <div className="mhf-s-body">
            <div className="mhf-f-group">
              <label className="mhf-f-label">Bevorzugte Tage</label>
              <div className="mhf-f-hint">An welchen Wochentagen ist der Kunde am liebsten verfügbar?</div>
              <div className="mhf-day-chips">
                {DAY_OPTIONS.map((day) => {
                  const active = preferredDays.includes(day)
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => togglePreferredDay(day)}
                      className={`mhf-day-chip ${active ? 'active' : ''}`}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="mhf-f-group">
              <label className="mhf-f-label">Bevorzugte Uhrzeit</label>
              <select value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} className="mhf-f-select">
                {PREFERRED_TIME.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="mhf-f-row">
              {showIntervalWeeksField ? (
                <div className="mhf-f-group">
                  <label className="mhf-f-label">Bearbeitungsintervall</label>
                  <select value={intervalWeeks} onChange={(e) => setIntervalWeeks(e.target.value)} className="mhf-f-select">
                    {INTERVAL_WEEKS.map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="mhf-f-group">
                <label className="mhf-f-label">Erinnerung senden</label>
                <select value={reminderTiming} onChange={(e) => setReminderTiming(e.target.value)} className="mhf-f-select">
                  {REMINDER_TIMING.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Notizen & Sonstiges */}
        <section className="mhf-section">
          <div className="mhf-s-header">
            <i className="bi bi-chat-quote-fill mhf-s-icon" aria-hidden />
            <h3>Notizen & Sonstiges</h3>
          </div>
          <div className="mhf-s-body">
            <div className="mhf-f-group">
              <label className="mhf-f-label">Interne Notizen</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mhf-f-textarea" placeholder="z. B. Kundin wurde empfohlen. Möchte auf Barhuf umstellen." rows={3} />
              <div className="mhf-f-hint">Nur für dich sichtbar</div>
            </div>
            <div className="mhf-f-group">
              <label className="mhf-f-label">Wie auf dich aufmerksam geworden?</label>
              <select value={source} onChange={(e) => setSource(e.target.value)} className="mhf-f-select">
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s || 'empty'} value={s}>{s || 'Bitte wählen'}</option>
                ))}
              </select>
              <div className="mhf-f-hint">Hilft dir zu verstehen, welche Kanäle neue Kunden bringen</div>
            </div>
          </div>
        </section>

        {/* 5. Erstes Pferd direkt anlegen */}
        <section className={`mhf-section ${errorFields.includes('horseName') ? 'mhf-field-error' : ''}`}>
          <div className="mhf-s-header">
            <i className="bi bi-plus-circle-fill mhf-s-icon" aria-hidden />
            <h3>Erstes Pferd direkt anlegen?</h3>
            <span className="mhf-s-hint">Optional</span>
          </div>
          <div className="mhf-s-body">
            <div className="mhf-toggle-row">
              <div className="mhf-toggle-info">
                <div className="mhf-toggle-title">Erstes Pferd direkt mit anlegen</div>
                <div className="mhf-toggle-sub">Du kannst das erste Pferd optional direkt mit anlegen</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={addHorseNow}
                className={`mhf-toggle-switch ${addHorseNow ? 'on' : ''}`}
                onClick={() => setAddHorseNow((p) => !p)}
              />
            </div>
            {addHorseNow && (
              <>
                <div className={`mhf-f-group ${errorFields.includes('horseName') ? 'mhf-has-error' : ''}`}>
                  <label className="mhf-f-label">Name des Pferdes <span className="mhf-req">*</span></label>
                  <input value={horseName} onChange={(e) => { setHorseName(e.target.value); clearError('horseName')(); }} className="mhf-f-input" placeholder="z. B. Stella" />
                </div>
                <div className="mhf-f-row">
                  <div className="mhf-f-group">
                    <label className="mhf-f-label">Rasse</label>
                    <input value={horseBreed} onChange={(e) => setHorseBreed(e.target.value)} className="mhf-f-input" placeholder="z. B. Haflinger" />
                  </div>
                  <div className="mhf-f-group">
                    <label className="mhf-f-label">Geschlecht</label>
                    <select value={horseGender} onChange={(e) => setHorseGender(e.target.value)} className="mhf-f-select">
                      <option value="">Bitte wählen</option>
                      <option>Stute</option>
                      <option>Wallach</option>
                      <option>Hengst</option>
                    </select>
                  </div>
                </div>
                <div className="mhf-f-row-3">
                  <div className="mhf-f-group">
                    <label className="mhf-f-label">Geburtsjahr</label>
                    <input value={horseBirthYear} onChange={(e) => setHorseBirthYear(e.target.value)} className="mhf-f-input" placeholder="z. B. 2014" />
                  </div>
                  <div className="mhf-f-group">
                    <label className="mhf-f-label">Nutzung</label>
                    <select value={horseUsage} onChange={(e) => setHorseUsage(e.target.value)} className="mhf-f-select">
                      {HORSE_USAGE.map((u) => <option key={u || 'empty'} value={u}>{u || 'Bitte wählen'}</option>)}
                    </select>
                  </div>
                  <div className="mhf-f-group">
                    <label className="mhf-f-label">Beschlag</label>
                    <select value={horseShoeing} onChange={(e) => setHorseShoeing(e.target.value)} className="mhf-f-select">
                      {HORSE_SHOEING.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mhf-f-group">
                  <label className="mhf-f-label">Besonderheiten / Hufhistorie</label>
                  <textarea value={horseSpecialNotes} onChange={(e) => setHorseSpecialNotes(e.target.value)} className="mhf-f-textarea" placeholder="z. B. Wurde früher beschlagen, seit 2023 barhuf." rows={2} />
                  <div className="mhf-f-hint">Medizinische Hinweise, Hufprobleme, Verhaltensbesonderheiten</div>
                </div>

                <div className="mhf-s-header" style={{ marginTop: 18 }}>
                  <i className="bi bi-pin-map-fill mhf-s-icon" aria-hidden />
                  <h3>Stall / Standort dieses Pferdes</h3>
                  <span className="mhf-s-hint">Optional – für Route &amp; Anfahrt</span>
                </div>
                <div className="mhf-f-group">
                  <label className="mhf-f-label">Stalladresse suchen</label>
                  <AddressAutocomplete
                    placeholder="z. B. Am Waldrand 7, 53567 Asbach"
                    onSelect={(a: AddressSuggestion) => {
                      setStableStreet(a.street)
                      setStableZip(a.zip)
                      setStableCity(a.city)
                      if (a.country) setStableCountry(a.country)
                    }}
                    className="mhf-f-input"
                  />
                </div>
                <div className="mhf-f-group">
                  <label className="mhf-f-label">Name des Stalls / Hofs</label>
                  <input value={stableName} onChange={(e) => setStableName(e.target.value)} className="mhf-f-input" placeholder="z. B. Reiterhof Sonnental" />
                </div>
                <div className="mhf-f-group">
                  <label className="mhf-f-label">Straße & Hausnummer</label>
                  <input value={stableStreet} onChange={(e) => setStableStreet(e.target.value)} className="mhf-f-input" placeholder="z. B. Am Waldrand 7" />
                </div>
                <div className="mhf-f-row">
                  <div className="mhf-f-group">
                    <label className="mhf-f-label">PLZ</label>
                    <input value={stableZip} onChange={(e) => setStableZip(e.target.value)} className="mhf-f-input" placeholder="z. B. 53567" />
                  </div>
                  <div className="mhf-f-group">
                    <label className="mhf-f-label">Ort</label>
                    <input value={stableCity} onChange={(e) => setStableCity(e.target.value)} className="mhf-f-input" placeholder="z. B. Asbach" />
                  </div>
                </div>
                <div className="mhf-f-group">
                  <label className="mhf-f-label">Land</label>
                  <select value={stableCountry} onChange={(e) => setStableCountry(e.target.value)} className="mhf-f-select">
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mhf-f-group">
                  <label className="mhf-f-label">Ansprechpartner vor Ort</label>
                  <input value={stableContact} onChange={(e) => setStableContact(e.target.value)} className="mhf-f-input" placeholder="z. B. Stallbesitzer Hans Müller" />
                </div>
                <div className="mhf-f-group">
                  <label className="mhf-f-label">Telefon vor Ort</label>
                  <input value={stablePhone} onChange={(e) => setStablePhone(e.target.value)} className="mhf-f-input" placeholder="z. B. 02683 1234" type="tel" />
                </div>
                <div className="mhf-f-group">
                  <label className="mhf-f-label">Anfahrtshinweis</label>
                  <input value={directions} onChange={(e) => setDirections(e.target.value)} className="mhf-f-input" placeholder="z. B. Hofeinfahrt links, hinter Scheune" />
                </div>
              </>
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
              void handleSubmit()
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
