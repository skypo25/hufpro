'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-client'

export type SettingsData = {
  // Persönliche Daten
  salutation?: string
  firstName?: string
  lastName?: string
  jobTitle?: string
  qualification?: string
  phone?: string
  email?: string
  website?: string
  socialMedia?: string
  // Betriebsdaten
  companyName?: string
  legalForm?: string
  street?: string
  city?: string
  zip?: string
  country?: string
  // Steuer
  taxNumber?: string
  taxOffice?: string
  kleinunternehmer?: boolean
  kleinunternehmerText?: string
  ustId?: string
  defaultTaxRate?: string
  // Bank
  accountHolder?: string
  bank?: string
  iban?: string
  bic?: string
  paypal?: string
  paymentTerms?: string
  // Kundennummer (selbst aufgebaut wie Rechnungsnummer)
  customerNumberPrefix?: string
  nextCustomerNumber?: number
  // Rechnung
  invoicePrefix?: string
  nextInvoiceNumber?: string
  currency?: string
  invoiceDelivery?: string
  invoiceTextTop?: string
  invoiceTextBottom?: string
  // Leistungen
  services?: { label: string; price: string }[]
  // Logo (URL nach Upload)
  logoUrl?: string
  // SMTP für E-Mail-Versand
  smtpHost?: string
  smtpPort?: number
  smtpSecure?: boolean
  smtpUser?: string
  smtpPassword?: string
  smtpFromEmail?: string
  smtpFromName?: string
}

const DEFAULT_SETTINGS: SettingsData = {
  salutation: 'Herr',
  firstName: '',
  lastName: '',
  jobTitle: 'Barhufbearbeiter/in',
  qualification: '',
  phone: '',
  email: '',
  website: '',
  socialMedia: '',
  companyName: '',
  legalForm: 'Einzelunternehmen / Freiberufler',
  street: '',
  city: '',
  zip: '',
  country: 'Deutschland',
  taxNumber: '',
  taxOffice: '',
  kleinunternehmer: true,
  kleinunternehmerText: 'Gemäß §19 UStG wird keine Umsatzsteuer berechnet.',
  ustId: '',
  defaultTaxRate: '19% (Regelsteuersatz)',
  accountHolder: '',
  bank: '',
  iban: '',
  bic: '',
  paypal: '',
  paymentTerms: '7 Tage',
  customerNumberPrefix: 'K-',
  nextCustomerNumber: 1,
  invoicePrefix: 'HUF-',
  nextInvoiceNumber: '2026-0001',
  currency: 'EUR (€)',
  invoiceDelivery: 'Per E-Mail als PDF',
  invoiceTextTop: 'Vielen Dank für Ihr Vertrauen. Ich erlaube mir, folgende Leistungen in Rechnung zu stellen:',
  invoiceTextBottom: 'Bitte überweisen Sie den Betrag innerhalb von 7 Tagen auf das unten angegebene Konto. Bei Fragen stehe ich Ihnen gerne zur Verfügung.',
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpPassword: '',
  smtpFromEmail: '',
  smtpFromName: '',
  services: [
    { label: 'Barhufbearbeitung (1 Pferd, 4 Hufe)', price: '65,00 €' },
    { label: 'Bearbeitung 2 Pferde (Paketpreis)', price: '120,00 €' },
    { label: 'Bearbeitung 3 Pferde (Paketpreis)', price: '170,00 €' },
    { label: 'Erstbefund / Erstberatung', price: '45,00 €' },
    { label: 'Kontrolltermin / Nachkontrolle', price: '30,00 €' },
    { label: 'Hufschuhberatung & Anpassung', price: '25,00 €' },
    { label: 'Anfahrtspauschale (ab 30 km)', price: '15,00 €' },
  ],
}

export type SettingsCustomer = {
  id: string
  label: string
  name: string | null
  first_name: string | null
  last_name: string | null
  company: string | null
  street: string | null
  postal_code: string | null
  city: string | null
  country: string | null
}

type SettingsFormProps = {
  initialSettings: Record<string, unknown> | null
  userEmail?: string
  customers?: SettingsCustomer[]
}

const TABS = [
  { id: 'betrieb', label: 'Mein Betrieb' },
  { id: 'rechnung', label: 'Rechnungseinstellungen' },
  { id: 'benachrichtigungen', label: 'Benachrichtigungen' },
  { id: 'vorlagen', label: 'Vorlagen & Textbausteine' },
  { id: 'konto', label: 'Konto & Sicherheit' },
]

function FormSection({
  icon,
  iconBg,
  title,
  badge,
  badgeClass,
  children,
}: {
  icon: string
  iconBg: string
  title: string
  badge?: string
  badgeClass?: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-[#E5E2DC] bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-[#E5E2DC] px-6 py-4">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm ${iconBg}`}>{icon}</span>
        <h3 className="font-serif text-base font-medium text-[#1B1F23]">{title}</h3>
        {badge && (
          <span className={`ml-auto rounded-full px-2.5 py-1 text-[11px] font-medium ${badgeClass ?? 'bg-black/5 text-[#9CA3AF]'}`}>
            {badge}
          </span>
        )}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

function FormRow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid gap-5 pb-5 last:pb-0 md:grid-cols-2 ${className}`}>{children}</div>
}

function FormGroup({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
        {label}
        {required && <span className="text-[#EF4444]">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-[#9CA3AF]">{hint}</p>}
    </div>
  )
}

function inputClass() {
  return 'w-full rounded-lg border border-[#E5E2DC] bg-white px-3.5 py-2.5 text-sm text-[#1B1F23] outline-none transition-colors placeholder:text-[#9CA3AF] focus:border-[#154226] focus:ring-2 focus:ring-[#154226]/10'
}

export default function SettingsForm({ initialSettings, userEmail, customers = [] }: SettingsFormProps) {
  const merged: SettingsData = {
    ...DEFAULT_SETTINGS,
    ...(initialSettings as Partial<SettingsData>),
    email: userEmail ?? (initialSettings as SettingsData)?.email ?? '',
  }
  const [activeTab, setActiveTab] = useState('betrieb')
  const [s, setS] = useState<SettingsData>(merged)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [testInvoiceLoading, setTestInvoiceLoading] = useState(false)
  const [testInvoiceError, setTestInvoiceError] = useState<string | null>(null)
  const [testInvoiceCustomerId, setTestInvoiceCustomerId] = useState<string>('')
  const [testEmailLoading, setTestEmailLoading] = useState(false)
  const [testEmailError, setTestEmailError] = useState<string | null>(null)
  const [testEmailSuccess, setTestEmailSuccess] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const update = (key: keyof SettingsData, value: unknown) => {
    setS((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const updateService = (index: number, field: 'label' | 'price', value: string) => {
    const next = [...(s.services ?? [])]
    if (!next[index]) return
    next[index] = { ...next[index], [field]: value }
    update('services', next)
  }

  /** Formatiert Preis bei Verlassen des Feldes: "48" → "48,00 €", "14,00" → "14,00 €" */
  function formatPriceOnBlur(value: string): string {
    const trimmed = value.trim()
    if (!trimmed) return trimmed
    const normalized = trimmed.replace(',', '.').replace(/[^\d.-]/g, '')
    const num = parseFloat(normalized)
    if (Number.isNaN(num)) return trimmed
    const fixed = num.toFixed(2).replace('.', ',')
    return `${fixed} €`
  }

  const addService = () => {
    update('services', [...(s.services ?? []), { label: '', price: '' }])
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setLogoError('Bitte eine Bilddatei (JPG, PNG oder WebP) wählen.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Datei maximal 2 MB.')
      return
    }
    setLogoError(null)
    setLogoUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht angemeldet')
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'png'
      const path = `${user.id}/logo.${safeExt}`
      const { error: uploadErr } = await supabase.storage
        .from('user-logos')
        .upload(path, file, { contentType: file.type, upsert: true })
      if (uploadErr) throw uploadErr
      const { data: urlData } = supabase.storage.from('user-logos').getPublicUrl(path)
      update('logoUrl', urlData.publicUrl)
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Upload fehlgeschlagen')
    } finally {
      setLogoUploading(false)
    }
  }

  function handleLogoRemove() {
    setLogoError(null)
    update('logoUrl', '')
  }

  const removeService = (index: number) => {
    const next = (s.services ?? []).filter((_, i) => i !== index)
    update('services', next)
  }

  async function handleTestEmail() {
    setTestEmailError(null)
    setTestEmailSuccess(false)
    setTestEmailLoading(true)
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test: true,
          smtpHost: s.smtpHost,
          smtpPort: s.smtpPort,
          smtpSecure: s.smtpSecure,
          smtpUser: s.smtpUser,
          smtpPassword: s.smtpPassword,
          smtpFromEmail: s.smtpFromEmail,
          smtpFromName: s.smtpFromName,
          email: s.email,
          firstName: s.firstName,
          lastName: s.lastName,
          companyName: s.companyName,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setTestEmailError(data.error ?? 'Test-E-Mail konnte nicht versendet werden')
        return
      }
      setTestEmailSuccess(true)
    } finally {
      setTestEmailLoading(false)
    }
  }

  async function handleTestInvoice() {
    if (!testInvoiceCustomerId.trim()) {
      setTestInvoiceError('Bitte einen Kunden als Rechnungsempfänger auswählen.')
      return
    }
    setTestInvoiceError(null)
    setTestInvoiceLoading(true)
    try {
      const res = await fetch('/api/invoices/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: testInvoiceCustomerId }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; invoiceId?: string }
      if (!res.ok) {
        setTestInvoiceError(data.error ?? 'Test-Rechnung konnte nicht erstellt werden')
        return
      }
      if (data.invoiceId) {
        window.open(`/invoices/${data.invoiceId}/pdf`, '_blank', 'noopener,noreferrer')
      }
    } finally {
      setTestInvoiceLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setSaveError(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setSaveError(data.error ?? 'Speichern fehlgeschlagen')
        return
      }
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="mb-7 flex gap-0 border-b-2 border-[#E5E2DC] overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 border-b-2 px-5 py-3 text-sm font-medium transition-colors -mb-0.5 ${
              activeTab === tab.id
                ? 'border-[#154226] text-[#154226]'
                : 'border-transparent text-[#6B7280] hover:text-[#1B1F23]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'betrieb' && (
        <>
          <FormSection icon="👤" iconBg="bg-[#edf3ef] text-[#154226]" title="Persönliche Daten" badge="Pflichtfelder" badgeClass="bg-[#FEE2E2] text-[#991B1B]">
            <FormRow className="md:grid-cols-3">
              <FormGroup label="Anrede">
                <select className={inputClass()} value={s.salutation ?? ''} onChange={(e) => update('salutation', e.target.value)}>
                  <option>Herr</option>
                  <option>Frau</option>
                  <option>Divers</option>
                  <option>Keine Angabe</option>
                </select>
              </FormGroup>
              <FormGroup label="Vorname" required>
                <input type="text" className={inputClass()} value={s.firstName ?? ''} onChange={(e) => update('firstName', e.target.value)} />
              </FormGroup>
              <FormGroup label="Nachname" required>
                <input type="text" className={inputClass()} value={s.lastName ?? ''} onChange={(e) => update('lastName', e.target.value)} />
              </FormGroup>
            </FormRow>
            <FormRow>
              <FormGroup label="Berufsbezeichnung" required hint="Wird auf Rechnungen und PDF-Berichten angezeigt">
                <select className={inputClass()} value={s.jobTitle ?? ''} onChange={(e) => update('jobTitle', e.target.value)}>
                  <option value="">Bitte wählen</option>
                  <option>Barhufbearbeiter/in</option>
                  <option>Hufpfleger/in</option>
                  <option>Huforthopäde/in</option>
                  <option>Huftechniker/in</option>
                  <option>Hufheilpraktiker/in</option>
                  <option>Hufbeschlagschmied/in (staatl. geprüft)</option>
                  <option>Sonstige</option>
                </select>
              </FormGroup>
              <FormGroup label="Qualifikation / Ausbildung" hint="Zertifizierungen und Abschlüsse — erscheinen optional auf Berichten">
                <input type="text" className={inputClass()} placeholder="z. B. BPHC, DHG, DIFHO, F-Balance…" value={s.qualification ?? ''} onChange={(e) => update('qualification', e.target.value)} />
              </FormGroup>
            </FormRow>
            <FormRow>
              <FormGroup label="Telefon / Mobil" required>
                <input type="tel" className={inputClass()} placeholder="z. B. 0171 987 6543" value={s.phone ?? ''} onChange={(e) => update('phone', e.target.value)} />
              </FormGroup>
              <FormGroup label="E-Mail" required hint="Für Rechnungsversand und Kundenkommunikation">
                <input type="email" className={inputClass()} placeholder="z. B. name@domain.de" value={s.email ?? ''} onChange={(e) => update('email', e.target.value)} />
              </FormGroup>
            </FormRow>
            <FormRow>
              <FormGroup label="Website">
                <input type="url" className={inputClass()} placeholder="z. B. www.hufpflege-krueger.de" value={s.website ?? ''} onChange={(e) => update('website', e.target.value)} />
              </FormGroup>
              <FormGroup label="Social Media / Profil">
                <input type="text" className={inputClass()} placeholder="z. B. Instagram @hufpflege.krueger" value={s.socialMedia ?? ''} onChange={(e) => update('socialMedia', e.target.value)} />
              </FormGroup>
            </FormRow>
          </FormSection>

          <FormSection icon="🏢" iconBg="bg-[#DBEAFE] text-[#2563EB]" title="Betriebsdaten" badge="Für Rechnungen erforderlich" badgeClass="bg-[#FEE2E2] text-[#991B1B]">
            <FormRow>
              <FormGroup label="Firmenname / Betriebsname" hint="Wird als Absender auf Rechnungen angezeigt. Leer lassen = dein Name wird verwendet.">
                <input type="text" className={inputClass()} placeholder="z. B. Hufpflege Musterfrau" value={s.companyName ?? ''} onChange={(e) => update('companyName', e.target.value)} />
              </FormGroup>
              <FormGroup label="Rechtsform">
                <select className={inputClass()} value={s.legalForm ?? ''} onChange={(e) => update('legalForm', e.target.value)}>
                  <option>Einzelunternehmen / Freiberufler</option>
                  <option>GbR</option>
                  <option>GmbH</option>
                  <option>UG (haftungsbeschränkt)</option>
                  <option>Sonstiges</option>
                </select>
              </FormGroup>
            </FormRow>
            <p className="mb-2.5 mt-1 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Geschäftsadresse (für Rechnungen & Impressum)</p>
            <FormRow className="md:grid-cols-1">
              <FormGroup label="Straße & Hausnummer" required>
                <input type="text" className={inputClass()} placeholder="z. B. Waldweg 15" value={s.street ?? ''} onChange={(e) => update('street', e.target.value)} />
              </FormGroup>
            </FormRow>
            <FormRow className="md:grid-cols-[2fr_1fr_1fr]">
              <FormGroup label="Ort" required>
                <input type="text" className={inputClass()} placeholder="z. B. Asbach" value={s.city ?? ''} onChange={(e) => update('city', e.target.value)} />
              </FormGroup>
              <FormGroup label="PLZ" required>
                <input type="text" className={inputClass()} placeholder="z. B. 53567" value={s.zip ?? ''} onChange={(e) => update('zip', e.target.value)} />
              </FormGroup>
              <FormGroup label="Land">
                <select className={inputClass()} value={s.country ?? 'Deutschland'} onChange={(e) => update('country', e.target.value)}>
                  <option>Deutschland</option>
                  <option>Österreich</option>
                  <option>Schweiz</option>
                </select>
              </FormGroup>
            </FormRow>
          </FormSection>

          <FormSection icon="📊" iconBg="bg-[#FEF3C7] text-[#D97706]" title="Steuerliche Angaben" badge="Wichtig für korrekte Rechnungen" badgeClass="bg-[#DBEAFE] text-[#1E40AF]">
            <div className="mb-4 flex gap-3 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] p-4 text-[13px] leading-relaxed text-[#1E40AF]">
              <span className="shrink-0 text-lg">ℹ️</span>
              <p><strong>Hinweis:</strong> Diese Angaben sind entscheidend dafür, wie deine Rechnungen aussehen. Als Kleinunternehmer nach §19 UStG darfst du keine Umsatzsteuer ausweisen. HufPro erledigt das automatisch für dich.</p>
            </div>
            <FormRow>
              <FormGroup label="Steuernummer" required hint="Vom Finanzamt zugewiesen — erscheint auf jeder Rechnung">
                <input type="text" className={inputClass()} placeholder="z. B. 123/456/78901" value={s.taxNumber ?? ''} onChange={(e) => update('taxNumber', e.target.value)} />
              </FormGroup>
              <FormGroup label="Zuständiges Finanzamt">
                <input type="text" className={inputClass()} placeholder="z. B. Finanzamt Neuwied" value={s.taxOffice ?? ''} onChange={(e) => update('taxOffice', e.target.value)} />
              </FormGroup>
            </FormRow>
            <div className="rounded-xl border border-[#E5E2DC] p-5">
              <button
                type="button"
                onClick={() => update('kleinunternehmer', !s.kleinunternehmer)}
                className="flex w-full items-center gap-3"
              >
                <div className={`h-6 w-11 shrink-0 rounded-full transition-colors ${s.kleinunternehmer ? 'bg-[#154226]' : 'bg-[#E5E2DC]'}`}>
                  <div className={`mt-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${s.kleinunternehmer ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-[#1B1F23]">Kleinunternehmerregelung (§19 UStG)</div>
                  <div className="text-xs text-[#6B7280]">Ich weise keine Umsatzsteuer auf Rechnungen aus</div>
                </div>
              </button>
              {s.kleinunternehmer && (
                <div className="mt-4 border-t border-[#E5E2DC] pt-4">
                  <div className="mb-3 flex gap-3 rounded-lg border border-[#86EFAC] bg-[#F0FDF4] p-3 text-[13px] text-[#166534]">
                    <span>✓</span>
                    <p><strong>Kleinunternehmerregelung aktiv.</strong> Auf deinen Rechnungen wird keine MwSt. ausgewiesen. Es erscheint der gesetzlich vorgeschriebene Hinweistext.</p>
                  </div>
                  <FormGroup label="Hinweistext auf Rechnungen" hint="Muss den Verweis auf §19 UStG enthalten.">
                    <textarea className={`${inputClass()} min-h-[60px] resize-y`} rows={2} value={s.kleinunternehmerText ?? ''} onChange={(e) => update('kleinunternehmerText', e.target.value)} />
                  </FormGroup>
                </div>
              )}
            </div>
            <div className="mt-4 flex gap-3 rounded-lg border border-[#FDE68A] bg-[#FEF9EE] p-4 text-[13px] text-[#92400E]">
              <span className="shrink-0">⚠️</span>
              <p><strong>Wichtig:</strong> Die Kleinunternehmerregelung gilt nur, wenn dein Jahresumsatz im Vorjahr unter 22.000 € lag und im laufenden Jahr voraussichtlich unter 50.000 € bleibt.</p>
            </div>
          </FormSection>

          <FormSection icon="🏦" iconBg="bg-[#DCFCE7] text-[#166534]" title="Bankverbindung" badge="Für Rechnungen" badgeClass="bg-[#FEE2E2] text-[#991B1B]">
            <FormRow>
              <FormGroup label="Kontoinhaber" required>
                <input type="text" className={inputClass()} value={s.accountHolder ?? ''} onChange={(e) => update('accountHolder', e.target.value)} />
              </FormGroup>
              <FormGroup label="Bank">
                <input type="text" className={inputClass()} placeholder="z. B. Volksbank Westerwald" value={s.bank ?? ''} onChange={(e) => update('bank', e.target.value)} />
              </FormGroup>
            </FormRow>
            <FormRow>
              <FormGroup label="IBAN" required hint="Erscheint auf deinen Rechnungen im Fußbereich">
                <input type="text" className={inputClass()} placeholder="z. B. DE89 3704 0044 0532 0130 00" value={s.iban ?? ''} onChange={(e) => update('iban', e.target.value)} />
              </FormGroup>
              <FormGroup label="BIC" hint="Optional">
                <input type="text" className={inputClass()} placeholder="z. B. COBADEFFXXX" value={s.bic ?? ''} onChange={(e) => update('bic', e.target.value)} />
              </FormGroup>
            </FormRow>
            <FormRow>
              <FormGroup label="PayPal-Adresse" hint="Optional">
                <input type="email" className={inputClass()} placeholder="z. B. paypal@hufpflege.de" value={s.paypal ?? ''} onChange={(e) => update('paypal', e.target.value)} />
              </FormGroup>
              <FormGroup label="Standard-Zahlungsziel" hint="Wird auf neuen Rechnungen vorbelegt">
                <select className={inputClass()} value={s.paymentTerms ?? ''} onChange={(e) => update('paymentTerms', e.target.value)}>
                  <option>Sofort fällig</option>
                  <option>7 Tage</option>
                  <option>14 Tage</option>
                  <option>30 Tage</option>
                </select>
              </FormGroup>
            </FormRow>
          </FormSection>

          <FormSection icon="🎨" iconBg="bg-[#EDE9FE] text-[#7C3AED]" title="Logo & Erscheinungsbild" badge="Optional" badgeClass="bg-black/5 text-[#9CA3AF]">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleLogoChange}
            />
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div
                role="button"
                tabIndex={0}
                onClick={() => logoInputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') logoInputRef.current?.click() }}
                className="flex h-[100px] w-[100px] shrink-0 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[14px] border-2 border-dashed border-[#E5E2DC] bg-black/[0.01] transition-colors hover:border-[#154226] hover:bg-[#154226]/5"
              >
                {s.logoUrl ? (
                  <img src={s.logoUrl} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <>
                    <span className="text-2xl opacity-40">📷</span>
                    <span className="mt-1 text-[10px] font-medium text-[#9CA3AF]">Logo hochladen</span>
                  </>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] leading-relaxed text-[#6B7280]">Dein Logo erscheint auf Rechnungen und PDF-Berichten. Empfohlen: mind. 300×300 px, PNG oder JPG (max. 2 MB).</p>
                {logoError && <p className="mt-1 text-xs text-[#EF4444]">{logoError}</p>}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={logoUploading}
                    onClick={() => logoInputRef.current?.click()}
                    className="rounded-lg border border-[#E5E2DC] bg-white px-3.5 py-2 text-xs font-medium text-[#1B1F23] hover:border-[#9CA3AF] disabled:opacity-50"
                  >
                    {logoUploading ? 'Wird hochgeladen…' : 'Datei auswählen'}
                  </button>
                  <button
                    type="button"
                    onClick={handleLogoRemove}
                    className="px-3.5 py-2 text-xs font-medium text-[#EF4444] hover:underline"
                  >
                    Entfernen
                  </button>
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection icon="👤" iconBg="bg-[#E0E7FF] text-[#3730A3]" title="Kundennummer">
            <FormRow>
              <FormGroup label="Präfix" hint="z. B. K- oder KU-">
                <input type="text" className={inputClass()} placeholder="z. B. K-" value={s.customerNumberPrefix ?? 'K-'} onChange={(e) => update('customerNumberPrefix', e.target.value)} />
              </FormGroup>
              <FormGroup label="Nächste Kundennummer" hint="Wird beim Anlegen eines Kunden automatisch hochgezählt">
                <input type="number" min={1} className={inputClass()} value={s.nextCustomerNumber ?? 1} onChange={(e) => update('nextCustomerNumber', Math.max(1, parseInt(e.target.value, 10) || 1))} />
              </FormGroup>
            </FormRow>
          </FormSection>

          <FormSection icon="📄" iconBg="bg-[#FEF3C7] text-[#D97706]" title="Rechnungs-Voreinstellungen">
            <FormRow>
              <FormGroup label="Rechnungsnummer-Präfix" hint="z. B. HUF-2026-0001">
                <input type="text" className={inputClass()} placeholder="z. B. HUF-, RE-" value={s.invoicePrefix ?? ''} onChange={(e) => update('invoicePrefix', e.target.value)} />
              </FormGroup>
              <FormGroup label="Nächste Rechnungsnummer" hint="Wird automatisch hochgezählt">
                <input type="text" className={inputClass()} placeholder="z. B. 2026-0047" value={s.nextInvoiceNumber ?? ''} onChange={(e) => update('nextInvoiceNumber', e.target.value)} />
              </FormGroup>
            </FormRow>
            <FormRow>
              <FormGroup label="Währung">
                <select className={inputClass()} value={s.currency ?? ''} onChange={(e) => update('currency', e.target.value)}>
                  <option>EUR (€)</option>
                  <option>CHF (Fr.)</option>
                </select>
              </FormGroup>
              <FormGroup label="Rechnungsversand">
                <select className={inputClass()} value={s.invoiceDelivery ?? ''} onChange={(e) => update('invoiceDelivery', e.target.value)}>
                  <option>Per E-Mail als PDF</option>
                  <option>Per WhatsApp als PDF</option>
                  <option>Nur erstellen (manueller Versand)</option>
                </select>
              </FormGroup>
            </FormRow>
            <FormRow className="md:grid-cols-1">
              <FormGroup label="Standard-Rechnungstext (oben)">
                <textarea className={`${inputClass()} min-h-[70px] resize-y`} rows={2} value={s.invoiceTextTop ?? ''} onChange={(e) => update('invoiceTextTop', e.target.value)} />
              </FormGroup>
            </FormRow>
            <FormRow className="md:grid-cols-1">
              <FormGroup label="Standard-Rechnungstext (unten / Fußzeile)">
                <textarea className={`${inputClass()} min-h-[70px] resize-y`} rows={2} value={s.invoiceTextBottom ?? ''} onChange={(e) => update('invoiceTextBottom', e.target.value)} />
              </FormGroup>
            </FormRow>
          </FormSection>

          <FormSection icon="✂️" iconBg="bg-[#edf3ef] text-[#154226]" title="Leistungen & Preise" badge="Für Schnell-Abrechnung" badgeClass="bg-[#DBEAFE] text-[#1E40AF]">
            <div className="mb-4 flex gap-3 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] p-3 text-[13px] text-[#1E40AF]">
              <span>ℹ️</span>
              <p>Definiere hier deine Standardleistungen mit Preisen. Diese erscheinen bei der Abrechnung als Schnellauswahl.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-[#E5E2DC]">
                    <th className="pb-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Leistung</th>
                    <th className="w-[120px] pb-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Preis (netto)</th>
                    <th className="w-10 pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {(s.services ?? []).map((svc, i) => (
                    <tr key={i} className="border-b border-[#E5E2DC]">
                      <td className="py-2 pr-2">
                        <input type="text" className={inputClass()} value={svc.label} onChange={(e) => updateService(i, 'label', e.target.value)} />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          className={`${inputClass()} text-right`}
                          value={svc.price}
                          onChange={(e) => updateService(i, 'price', e.target.value)}
                          onBlur={(e) => {
                            const formatted = formatPriceOnBlur(e.target.value)
                            if (formatted !== e.target.value) updateService(i, 'price', formatted)
                          }}
                          placeholder="z. B. 65,00 €"
                        />
                      </td>
                      <td className="py-2 text-center">
                        <button type="button" onClick={() => removeService(i)} className="text-[18px] text-[#9CA3AF] hover:text-[#EF4444]" title="Entfernen">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addService} className="mt-3 w-full rounded-lg border-2 border-dashed border-[#E5E2DC] py-2.5 text-sm font-semibold text-[#154226] transition-colors hover:border-[#154226]">
              + Weitere Leistung hinzufügen
            </button>
          </FormSection>

          <FormSection icon="👁" iconBg="bg-[#F3F4F6] text-[#6B7280]" title="Rechnungsvorschau" badge="So sehen deine Rechnungen aus" badgeClass="bg-[#DBEAFE] text-[#1E40AF]">
            <div className="rounded-xl border border-[#E5E2DC] bg-black/[0.01] p-6 text-[13px] leading-relaxed">
              <div className="mb-4 flex justify-between border-b border-[#E5E2DC] pb-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#edf3ef] font-serif text-lg font-bold text-[#154226]">H</div>
                <div className="text-right text-xs text-[#6B7280]">
                  <strong className="text-[13px] text-[#1B1F23]">{s.companyName || `${s.firstName} ${s.lastName}`.trim() || 'Betriebsname'}</strong><br />
                  {[s.firstName, s.lastName].filter(Boolean).join(' ')} {s.qualification && `· ${s.qualification}`}<br />
                  {[s.street, [s.zip, s.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}<br />
                  {s.phone && `Tel: ${s.phone}`} {s.email && `· ${s.email}`}
                </div>
              </div>
              <div className="font-serif text-lg font-semibold">Rechnung</div>
              <div className="text-xs text-[#6B7280]">{s.invoicePrefix ?? 'HUF-'}{s.nextInvoiceNumber ?? '2026-0001'} · Zahlungsziel: {s.paymentTerms ?? '7 Tage'}</div>
              <div className="my-3 border-t border-b border-[#E5E2DC] py-2 text-xs text-[#6B7280]">Kunde: [Name] · [Adresse]</div>
              <div className="flex justify-between border-b border-dotted border-[#E5E2DC] py-1.5">
                <span>Barhufbearbeitung (1 Pferd, 4 Hufe)</span>
                <span className="font-semibold">65,00 €</span>
              </div>
              <div className="flex justify-between pt-2 font-bold">
                <span>Gesamtbetrag</span>
                <span className="text-[#154226]">65,00 €</span>
              </div>
              {s.kleinunternehmer && (
                <div className="mt-2 rounded-md bg-[#F0FDF4] px-3 py-2 text-[11px] text-[#166534]">
                  {s.kleinunternehmerText ?? 'Gemäß §19 UStG wird keine Umsatzsteuer berechnet.'}
                </div>
              )}
              <div className="mt-4 border-t border-[#E5E2DC] pt-3 text-center text-[11px] text-[#9CA3AF] leading-relaxed">
                {s.companyName || [s.firstName, s.lastName].filter(Boolean).join(' ')} · {[s.street, [s.zip, s.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}<br />
                StNr: {s.taxNumber || '…'} · IBAN: {s.iban ? `${s.iban.slice(0, 8)}…` : '…'}
              </div>
            </div>
          </FormSection>
        </>
      )}

      {activeTab === 'rechnung' && (
        <div className="rounded-xl border border-[#E5E2DC] bg-white p-8 text-center text-[#6B7280]">
          Rechnungseinstellungen — Inhalt folgt
        </div>
      )}
      {activeTab === 'benachrichtigungen' && (
        <>
          <FormSection icon="📧" iconBg="bg-[#DBEAFE] text-[#2563EB]" title="E-Mail-Versand (SMTP)" badge="Für Rechnungsversand & Benachrichtigungen" badgeClass="bg-[#DBEAFE] text-[#1E40AF]">
            <div className="mb-4 flex gap-3 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] p-4 text-[13px] leading-relaxed text-[#1E40AF]">
              <span className="shrink-0 text-lg">ℹ️</span>
              <p>Trage hier die Zugangsdaten deines E-Mail-Anbieters ein (z. B. GMX, Web.de, Strato, Mailtrap). <strong>Wichtig:</strong> Port 587 = „TLS/SSL: Nein“ (STARTTLS). Port 465 = „TLS/SSL: Ja“ (direkte SSL-Verbindung). Falsche Kombination führt zu Verbindungsfehlern.</p>
            </div>
            <FormRow>
              <FormGroup label="SMTP-Server (Host)" hint="z. B. smtp.gmx.net, smtp.web.de">
                <input type="text" className={inputClass()} placeholder="smtp.example.de" value={s.smtpHost ?? ''} onChange={(e) => update('smtpHost', e.target.value)} />
              </FormGroup>
              <FormGroup label="Port" hint="Üblich: 587 (TLS) oder 465 (SSL)">
                <input type="number" className={inputClass()} placeholder="587" min={1} max={65535} value={s.smtpPort ?? ''} onChange={(e) => update('smtpPort', e.target.value === '' ? undefined : Number(e.target.value))} />
              </FormGroup>
            </FormRow>
            <FormRow>
              <FormGroup label="TLS/SSL (sichere Verbindung)" hint="Port 587 → Nein (STARTTLS). Port 465 → Ja (SSL).">
                <button
                  type="button"
                  onClick={() => {
                    const next = !s.smtpSecure
                    const port = s.smtpPort ?? 587
                    setS((prev) => ({
                      ...prev,
                      smtpSecure: next,
                      smtpPort: next && port === 587 ? 465 : !next && port === 465 ? 587 : port,
                    }))
                    setSaved(false)
                  }}
                  className="flex w-full items-center gap-3"
                >
                  <div className={`h-6 w-11 shrink-0 rounded-full transition-colors ${s.smtpSecure ? 'bg-[#154226]' : 'bg-[#E5E2DC]'}`}>
                    <div className={`mt-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${s.smtpSecure ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-sm text-[#1B1F23]">{s.smtpSecure ? 'Ja (Port 465)' : 'Nein (Port 587)'}</span>
                </button>
              </FormGroup>
              <FormGroup label="Benutzername" hint="Meist deine vollständige E-Mail-Adresse">
                <input type="text" className={inputClass()} placeholder="name@example.de" value={s.smtpUser ?? ''} onChange={(e) => update('smtpUser', e.target.value)} autoComplete="off" />
              </FormGroup>
            </FormRow>
            <FormRow>
              <FormGroup label="Passwort / App-Passwort" hint="Leer lassen, um das bestehende Passwort beizubehalten">
                <input type="password" className={inputClass()} placeholder="••••••••" value={s.smtpPassword ?? ''} onChange={(e) => update('smtpPassword', e.target.value)} autoComplete="new-password" />
              </FormGroup>
              <FormGroup label="Absender-E-Mail (optional)" hint="Leer = deine E-Mail aus „Mein Betrieb“">
                <input type="email" className={inputClass()} placeholder="rechnung@example.de" value={s.smtpFromEmail ?? ''} onChange={(e) => update('smtpFromEmail', e.target.value)} />
              </FormGroup>
            </FormRow>
            <FormRow className="md:grid-cols-1">
              <FormGroup label="Absender-Name (optional)" hint="Leer = dein Name oder Betriebsname">
                <input type="text" className={inputClass()} placeholder="Hufpflege Mustermann" value={s.smtpFromName ?? ''} onChange={(e) => update('smtpFromName', e.target.value)} />
              </FormGroup>
            </FormRow>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleTestEmail}
                disabled={testEmailLoading || !(s.smtpHost?.trim() && s.smtpUser?.trim())}
                className="inline-flex items-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5 text-sm font-medium text-[#1B1F23] transition-colors hover:border-[#2563EB] hover:bg-[#EFF6FF] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {testEmailLoading ? 'Wird gesendet…' : 'Test-E-Mail senden'}
              </button>
              {testEmailSuccess && <span className="text-sm text-[#34A853]">✓ Test-E-Mail wurde versendet. Prüfe dein Postfach.</span>}
              {testEmailError && <span className="text-sm text-[#EF4444]">{testEmailError}</span>}
            </div>
          </FormSection>
        </>
      )}
      {activeTab === 'vorlagen' && (
        <div className="rounded-xl border border-[#E5E2DC] bg-white p-8 text-center text-[#6B7280]">
          Vorlagen & Textbausteine — Inhalt folgt
        </div>
      )}
      {activeTab === 'konto' && (
        <div className="rounded-xl border border-[#E5E2DC] bg-white p-8 text-center text-[#6B7280]">
          Konto & Sicherheit — Inhalt folgt
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#E5E2DC] pt-6">
        <div className="flex flex-col gap-2">
          <Link href="/dashboard" className="rounded-lg px-4 py-2.5 text-sm font-medium text-[#6B7280] hover:text-[#1B1F23]">
            Änderungen verwerfen
          </Link>
          {saveError && (
            <p className="max-w-md text-sm text-[#EF4444]">{saveError}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {testInvoiceError && <span className="w-full text-sm text-[#EF4444]">{testInvoiceError}</span>}
          {customers.length === 0 ? (
            <p className="text-sm text-[#6B7280]">Zum Erstellen einer Test-Rechnung zuerst unter <Link href="/customers" className="text-[#154226] hover:underline">Kunden</Link> mindestens einen anlegen.</p>
          ) : (
            <div className="flex items-center gap-2">
              <label htmlFor="test-invoice-customer" className="text-sm font-medium text-[#6B7280]">
                Rechnungsempfänger:
              </label>
              <select
                id="test-invoice-customer"
                value={testInvoiceCustomerId}
                onChange={(e) => { setTestInvoiceCustomerId(e.target.value); setTestInvoiceError(null); }}
                className="rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-sm text-[#1B1F23] focus:border-[#154226] focus:outline-none focus:ring-2 focus:ring-[#154226]/10 min-w-[200px]"
              >
                <option value="">Kunde wählen …</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          )}
          <button
            type="button"
            onClick={handleTestInvoice}
            disabled={testInvoiceLoading || customers.length === 0 || !testInvoiceCustomerId.trim()}
            className="inline-flex items-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5 text-sm font-medium text-[#1B1F23] transition-colors hover:border-[#9CA3AF] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {testInvoiceLoading ? 'Wird erstellt…' : 'Test-Rechnung erstellen'}
          </button>
          {saved && <span className="text-sm text-[#34A853]">Gespeichert</span>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="huf-btn-dark inline-flex items-center gap-2 rounded-lg bg-[#154226] px-6 py-3 text-[15px] font-medium text-white transition-colors hover:bg-[#0f301b] disabled:opacity-60"
          >
            {saving ? 'Speichern …' : '✓ Speichern'}
          </button>
        </div>
      </div>
    </>
  )
}
