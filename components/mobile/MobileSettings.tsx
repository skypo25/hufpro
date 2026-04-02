'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-client'
import { type SettingsData, DEFAULT_SETTINGS } from '@/components/settings/SettingsForm'
import { canAccessApp, getBillingState } from '@/lib/billing/state'
import type { BillingAccountRow } from '@/lib/billing/types'
import { APPOINTMENT_REMINDER_MINUTES_OPTIONS } from '@/lib/appointments/reminderOptions'

const TABS = [
  { id: 'betrieb', label: 'Mein Betrieb' },
  { id: 'rechnung', label: 'Rechnungen' },
  { id: 'benachrichtigungen', label: 'Benachrichtigungen' },
  { id: 'konto', label: 'Konto & Sicherheit' },
]

function SecAccordion({
  open: initialOpen,
  icon,
  title,
  hint,
  children,
}: {
  open?: boolean
  icon: string
  title: string
  hint?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(!!initialOpen)
  return (
    <div className="mb-2.5 overflow-hidden rounded-[14px] border border-[#E5E2DC] bg-white shadow-[0_1px_3px_rgba(0,0,0,.06)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3.5 text-left active:bg-black/[0.01]"
      >
        <i className={`bi ${icon} text-[15px] text-[#52b788] shrink-0`} aria-hidden />
        <h3 className="flex-1 font-[Outfit] text-[14px] font-medium text-[#1B1F23]">{title}</h3>
        {hint && <span className="text-[10px] font-semibold text-[#52b788]">{hint}</span>}
        <svg
          className={`h-[18px] w-[18px] shrink-0 text-[#9CA3AF] transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div
        className="overflow-hidden transition-[max-height] duration-300 ease-out"
        style={{ maxHeight: open ? 3000 : 0 }}
      >
        <div className="border-t border-[#E5E2DC] px-4 pb-4 pt-0">{children}</div>
      </div>
    </div>
  )
}

// ─── Form layout matching MobileCustomerEdit ──────────────────────────────────

const inputClass = 'w-full rounded-[10px] border-[1.5px] border-[#cdcdd0] bg-[#fafafa] px-3 py-2.5 text-[15px] text-[#111] outline-none placeholder:text-[#9CA3AF] focus:border-[#52b788] focus:ring-2 focus:ring-[#52b788]/10 font-[inherit]'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 13px',
  border: '1.5px solid #cdcdd0', borderRadius: 10,
  fontSize: 15, fontFamily: 'var(--font-dm-sans,"DM Sans",sans-serif)',
  color: '#111', background: '#fafafa', outline: 'none',
  boxSizing: 'border-box', WebkitAppearance: 'none',
}

function FGroup({ label, required, hint, children }: {
  label?: string; required?: boolean; hint?: string; children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <FLabel required={required}>{label}</FLabel>}
      {children}
      {hint && <FHint>{hint}</FHint>}
    </div>
  )
}

function FLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5, fontFamily: 'var(--font-dm-sans,"DM Sans",sans-serif)' }}>
      {children}{required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
    </label>
  )
}

function FHint({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3, fontFamily: 'var(--font-dm-sans,"DM Sans",sans-serif)' }}>{children}</div>
}

function FRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>{children}</div>
}

function FRow3({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>{children}</div>
}

function FInput({ value, onChange, placeholder, type = 'text', inputMode, autoComplete, disabled }: {
  value: string; onChange: (v: string) => void
  placeholder?: string; type?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  autoComplete?: string; disabled?: boolean
}) {
  return (
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} inputMode={inputMode} autoComplete={autoComplete} disabled={disabled}
      style={{ ...inputStyle, ...(disabled ? { opacity: 0.7 } : {}) }}
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

export default function MobileSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [s, setS] = useState<SettingsData | null>(null)
  const [activeTab, setActiveTab] = useState('betrieb')
  const [canExportData, setCanExportData] = useState(false)
  const logoInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/billing/account', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { account?: BillingAccountRow | null } | null) => {
        if (cancelled || !data) return
        const state = getBillingState({
          account: data.account ?? null,
          priceIdMonthly: null,
        })
        setCanExportData(canAccessApp(state))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: row } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', user.id)
      .maybeSingle()
    const raw = (row?.settings ?? {}) as Partial<SettingsData>
    if ('smtpPassword' in raw) delete (raw as Record<string, unknown>).smtpPassword
    const merged: SettingsData = {
      ...DEFAULT_SETTINGS,
      ...raw,
      email: user.email ?? raw.email ?? '',
    }
    setS(merged)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const update = (key: keyof SettingsData, value: unknown) => {
    setS((prev) => (prev ? { ...prev, [key]: value } : null))
    setSaved(false)
  }

  async function handleSave() {
    if (!s) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Speichern fehlgeschlagen')
        return
      }
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !s) {
    return (
      <div className="mce-root">
        <div style={{ height: 'calc(8px + env(safe-area-inset-top,0))', background: '#1c2023' }} />
        <header style={{ background: '#1c2023', color: '#fff', padding: '20px 20px 14px' }}>
          <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 22, fontWeight: 600 }}>Einstellungen</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>Lädt…</div>
        </header>
        <div style={{ padding: 20, textAlign: 'center', color: '#6B7280' }}>Laden…</div>
      </div>
    )
  }

  const tabH = 64
  const safeBottom = 'env(safe-area-inset-bottom, 0px)'

  return (
    <div className="ms-root" style={{ background: '#f6f5f3', minHeight: '100dvh' }}>
      {/* Status Bar */}
      <div style={{ height: 'calc(8px + env(safe-area-inset-top, 0px))', background: '#1c2023' }} />

      {/* Dark Header */}
      <header style={{ background: '#1c2023', color: '#fff', padding: '20px 20px 14px' }}>
        <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 22, fontWeight: 600 }}>Einstellungen</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>
          Deine Betriebsdaten, Rechnungseinstellungen und Profil
        </div>
      </header>

      {/* Tabs */}
      <div
        className="overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden"
        style={{
          background: '#fff',
          borderBottom: '1px solid #E5E2DC',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div className="flex gap-0 px-4" style={{ scrollbarWidth: 'none' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 whitespace-nowrap border-b-2 px-3.5 py-3 text-[12px] font-medium -mb-px ${
                activeTab === tab.id
                  ? 'border-[#1c2023] text-[#1B1F23] font-semibold'
                  : 'border-transparent text-[#9CA3AF]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          padding: '14px 16px',
          paddingBottom: `calc(64px + ${safeBottom} + 20px)`,
        }}
      >
        {error && (
          <div
            className="mb-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-[11px]"
            style={{ background: '#FEE2E2', border: '1px solid #FECACA', color: '#991B1B' }}
          >
            <i className="bi bi-exclamation-triangle-fill shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {activeTab === 'betrieb' && (
          <>
            <SecAccordion open icon="bi-person-fill" title="Persönliche Daten" hint="Pflichtangaben">
              <FRow3>
                <FGroup label="Anrede">
                  <select className={inputClass} value={s.salutation ?? ''} onChange={(e) => update('salutation', e.target.value)}>
                    <option>Herr</option>
                    <option>Frau</option>
                    <option>Divers</option>
                  </select>
                </FGroup>
                <FGroup label="Vorname" required>
                  <input className={inputClass} value={s.firstName ?? ''} onChange={(e) => update('firstName', e.target.value)} />
                </FGroup>
                <FGroup label="Nachname" required>
                  <input className={inputClass} value={s.lastName ?? ''} onChange={(e) => update('lastName', e.target.value)} />
                </FGroup>
              </FRow3>
              <FRow>
                <FGroup label="Berufsbezeichnung" required>
                  <select className={inputClass} value={s.jobTitle ?? ''} onChange={(e) => update('jobTitle', e.target.value)}>
                    <option>Barhufbearbeiter/in</option>
                    <option>Hufschmied/in</option>
                    <option>Tierheilpraktiker/in</option>
                    <option>Sonstige</option>
                  </select>
                </FGroup>
                <FGroup label="Qualifikation" hint="z. B. BPHC">
                  <input className={inputClass} value={s.qualification ?? ''} onChange={(e) => update('qualification', e.target.value)} placeholder="BPHC" />
                </FGroup>
              </FRow>
              <FRow>
                <FGroup label="Telefon / Mobil" required>
                  <input className={inputClass} type="tel" value={s.phone ?? ''} onChange={(e) => update('phone', e.target.value)} />
                </FGroup>
                <FGroup label="E-Mail" required>
                  <input className={inputClass} type="email" value={s.email ?? ''} onChange={(e) => update('email', e.target.value)} />
                </FGroup>
              </FRow>
              <FRow>
                <FGroup label="Website">
                  <input className={inputClass} value={s.website ?? ''} onChange={(e) => update('website', e.target.value)} placeholder="www.beispiel.de" />
                </FGroup>
                <FGroup label="Social Media">
                  <input className={inputClass} value={s.socialMedia ?? ''} onChange={(e) => update('socialMedia', e.target.value)} placeholder="z. B. Instagram @hufpflege" />
                </FGroup>
              </FRow>
            </SecAccordion>

            <SecAccordion icon="bi-building" title="Betriebsdaten" hint="Für Rechnungen erforderlich">
              <FRow>
                <FGroup label="Firmenname / Betriebsname">
                  <input className={inputClass} value={s.companyName ?? ''} onChange={(e) => update('companyName', e.target.value)} />
                </FGroup>
                <FGroup label="Rechtsform">
                  <select className={inputClass} value={s.legalForm ?? ''} onChange={(e) => update('legalForm', e.target.value)}>
                    <option>Einzelunternehmen / Freiberufler</option>
                    <option>GbR</option>
                    <option>GmbH</option>
                    <option>UG</option>
                  </select>
                </FGroup>
              </FRow>
              <FGroup label="Straße & Hausnummer" required>
                <input className={inputClass} value={s.street ?? ''} onChange={(e) => update('street', e.target.value)} placeholder="Hauptstraße 68" />
              </FGroup>
              <FRow3>
                <FGroup label="Ort" required>
                  <input className={inputClass} value={s.city ?? ''} onChange={(e) => update('city', e.target.value)} />
                </FGroup>
                <FGroup label="PLZ" required>
                  <input className={inputClass} value={s.zip ?? ''} onChange={(e) => update('zip', e.target.value)} inputMode="numeric" />
                </FGroup>
                <FGroup label="Land">
                  <select className={inputClass} value={s.country ?? 'Deutschland'} onChange={(e) => update('country', e.target.value)}>
                    <option>Deutschland</option>
                    <option>Österreich</option>
                    <option>Schweiz</option>
                  </select>
                </FGroup>
              </FRow3>
            </SecAccordion>

            <SecAccordion icon="bi-compass-fill" title="Navigation">
              <FGroup label="Bevorzugte Navigations-App" hint="Für Routen zu Terminen">
                <select className={inputClass} value={s.preferredNavApp ?? ''} onChange={(e) => update('preferredNavApp', e.target.value as SettingsData['preferredNavApp'])}>
                  <option value="">Google Maps (Standard)</option>
                  <option value="google">Google Maps</option>
                  <option value="apple">Apple Karten</option>
                  <option value="waze">Waze</option>
                </select>
              </FGroup>
            </SecAccordion>

            <SecAccordion icon="bi-bank" title="Steuerliche Angaben" hint="Wichtig für Rechnungen">
              <div className="mb-3 flex gap-2 rounded-lg px-3 py-2.5 text-[11px]" style={{ background: '#FDF6EC', border: '1px solid #E8D5B0', color: '#B8860B' }}>
                <i className="bi bi-exclamation-triangle-fill shrink-0" />
                <span>Kleinunternehmer nach §19 UStG darfst du keine Umsatzsteuer ausweisen.</span>
              </div>
              <FRow>
                <FGroup label="Steuernummer" hint="Vom Finanzamt">
                  <input className={inputClass} value={s.taxNumber ?? ''} onChange={(e) => update('taxNumber', e.target.value)} />
                </FGroup>
                <FGroup label="Zuständiges Finanzamt">
                  <input className={inputClass} value={s.taxOffice ?? ''} onChange={(e) => update('taxOffice', e.target.value)} />
                </FGroup>
              </FRow>
              <div
                className="mb-3 flex items-center gap-3 rounded-lg px-3 py-2.5"
                style={{ background: 'rgba(82,183,136,.06)', border: '1px solid rgba(82,183,136,.15)' }}
              >
                <div className="flex flex-1 flex-col">
                  <span className="text-[12px] font-semibold">Kleinunternehmerregelung (§19 UStG)</span>
                  <span className="text-[10px] text-[#9CA3AF]">Keine Umsatzsteuer auf Rechnungen</span>
                </div>
                <button
                  type="button"
                  onClick={() => update('kleinunternehmer', !s.kleinunternehmer)}
                  className={`h-6 w-11 shrink-0 rounded-full transition-colors ${s.kleinunternehmer ? 'bg-[#52b788]' : 'bg-[#D1D5DB]'}`}
                  style={{ padding: 2 }}
                >
                  <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${s.kleinunternehmer ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              {s.kleinunternehmer && (
                <div className="mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-[11px]" style={{ background: 'rgba(82,183,136,.06)', border: '1px solid rgba(82,183,136,.15)', color: '#2D7A3A' }}>
                  <i className="bi bi-check-circle-fill" />
                  <span>Kleinunternehmerregelung aktiv. Keine MwSt. auf Rechnungen.</span>
                </div>
              )}
              <FGroup label="Hinweistext auf Rechnungen" hint="Mit §19 UStG">
                <input className={inputClass} value={s.kleinunternehmerText ?? ''} onChange={(e) => update('kleinunternehmerText', e.target.value)} />
              </FGroup>
            </SecAccordion>

            <SecAccordion icon="bi-image-fill" title="Logo & Erscheinungsbild" hint="Optional">
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-[#E5E2DC] p-3.5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#E8E6E2]">
                  {s.logoUrl ? (
                    <img src={s.logoUrl} alt="Logo" className="h-full w-full object-contain" />
                  ) : (
                    <i className="bi bi-image text-[#9CA3AF] text-[20px]" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-[11px] text-[#6B7280] leading-snug">
                    Logo für Rechnungen und PDF-Berichte. Mind. 300×300 px, PNG/JPG (max. 2 MB).
                  </p>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      ref={logoInputRef}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        e.target.value = ''
                        if (!file || !file.type.startsWith('image/')) return
                        try {
                          const { data: { user } } = await supabase.auth.getUser()
                          if (!user) return
                          const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
                          const path = `${user.id}/logo.${ext}`
                          await supabase.storage.from('user-logos').upload(path, file, { contentType: file.type, upsert: true })
                          const { data: urlData } = supabase.storage.from('user-logos').getPublicUrl(path)
                          update('logoUrl', urlData.publicUrl)
                        } catch {
                          setError('Logo-Upload fehlgeschlagen')
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="text-[11px] font-semibold text-[#52b788]"
                    >
                      Datei auswählen
                    </button>
                    <button type="button" onClick={() => update('logoUrl', '')} className="text-[11px] font-semibold text-[#DC2626]">
                      Entfernen
                    </button>
                  </div>
                </div>
              </div>
            </SecAccordion>
          </>
        )}

        {activeTab === 'rechnung' && (
          <>
            <SecAccordion open icon="bi-credit-card-fill" title="Bankverbindung" hint="Für Rechnungen">
              <FRow>
                <FGroup label="Kontoinhaber" required>
                  <input className={inputClass} value={s.accountHolder ?? ''} onChange={(e) => update('accountHolder', e.target.value)} />
                </FGroup>
                <FGroup label="Bank">
                  <input className={inputClass} value={s.bank ?? ''} onChange={(e) => update('bank', e.target.value)} />
                </FGroup>
              </FRow>
              <FRow>
                <FGroup label="IBAN" required hint="Auf Rechnungen im Fußbereich">
                  <input className={inputClass} value={s.iban ?? ''} onChange={(e) => update('iban', e.target.value)} />
                </FGroup>
                <FGroup label="BIC" hint="Optional">
                  <input className={inputClass} value={s.bic ?? ''} onChange={(e) => update('bic', e.target.value)} />
                </FGroup>
              </FRow>
              <FRow>
                <FGroup label="PayPal-Adresse">
                  <input className={inputClass} type="email" value={s.paypal ?? ''} onChange={(e) => update('paypal', e.target.value)} />
                </FGroup>
                <FGroup label="Standard-Zahlungsziel">
                  <select className={inputClass} value={s.paymentTerms ?? ''} onChange={(e) => update('paymentTerms', e.target.value)}>
                    <option>Sofort fällig</option>
                    <option>7 Tage</option>
                    <option>14 Tage</option>
                    <option>30 Tage</option>
                  </select>
                </FGroup>
              </FRow>
            </SecAccordion>

            <SecAccordion icon="bi-hash" title="Kundennummer">
              <FRow>
                <FGroup label="Präfix" hint="z. B. K-">
                  <input className={inputClass} value={s.customerNumberPrefix ?? 'K-'} onChange={(e) => update('customerNumberPrefix', e.target.value)} />
                </FGroup>
                <FGroup label="Nächste Kundennummer" hint="Wird automatisch hochgezählt">
                  <input className={inputClass} type="number" min={1} value={s.nextCustomerNumber ?? 1} onChange={(e) => update('nextCustomerNumber', Math.max(1, parseInt(e.target.value, 10) || 1))} />
                </FGroup>
              </FRow>
            </SecAccordion>

            <SecAccordion icon="bi-file-earmark-text-fill" title="Rechnungs-Voreinstellungen">
              <FRow>
                <FGroup label="Rechnungsnummer-Präfix" hint="z. B. HUF-2026-0001">
                  <input className={inputClass} value={s.invoicePrefix ?? 'HUF-'} onChange={(e) => update('invoicePrefix', e.target.value)} />
                </FGroup>
                <FGroup label="Nächste Rechnungsnummer">
                  <input className={inputClass} value={s.nextInvoiceNumber ?? ''} onChange={(e) => update('nextInvoiceNumber', e.target.value)} />
                </FGroup>
              </FRow>
              <FRow>
                <FGroup label="Währung">
                  <select className={inputClass} value={s.currency ?? 'EUR (€)'} onChange={(e) => update('currency', e.target.value)}>
                    <option>EUR (€)</option>
                    <option>CHF (Fr.)</option>
                  </select>
                </FGroup>
                <FGroup label="Rechnungsversand">
                  <select className={inputClass} value={s.invoiceDelivery ?? ''} onChange={(e) => update('invoiceDelivery', e.target.value)}>
                    <option>Nur erstellen (manueller Versand)</option>
                    <option>Automatisch per E-Mail</option>
                  </select>
                </FGroup>
              </FRow>
              <FGroup label="Standard-Rechnungstext (oben)">
                <textarea className={`${inputClass} min-h-[70px] resize-y`} rows={2} value={s.invoiceTextTop ?? ''} onChange={(e) => update('invoiceTextTop', e.target.value)} />
              </FGroup>
              <FGroup label="Standard-Rechnungstext (unten)" hint="Für schnelle Abrechnung">
                <textarea className={`${inputClass} min-h-[70px] resize-y`} rows={2} value={s.invoiceTextBottom ?? ''} onChange={(e) => update('invoiceTextBottom', e.target.value)} />
              </FGroup>
            </SecAccordion>

            <SecAccordion icon="bi-tags-fill" title="Leistungen & Preise">
              <div className="mb-3 flex gap-2 rounded-lg px-3 py-2.5 text-[11px]" style={{ background: 'rgba(82,183,136,.06)', border: '1px solid rgba(82,183,136,.15)', color: '#2D7A3A' }}>
                <i className="bi bi-info-circle-fill shrink-0" />
                <span>Standardleistungen mit Preisen – erscheinen bei der Abrechnung als Schnellauswahl.</span>
              </div>
              {(s.services ?? []).map((svc, i) => (
                <div key={i} className="flex items-center gap-2 border-b border-[#F0EEEA] py-2.5 last:border-0">
                  <span className="flex-1 text-[12px] font-medium">{svc.label}</span>
                  <span className="min-w-[60px] text-right text-[13px] font-bold">{svc.price}</span>
                  <i className="bi bi-pencil-fill text-[#9CA3AF] cursor-pointer text-[14px]" aria-hidden />
                </div>
              ))}
              <button
                type="button"
                className="mt-2 flex w-full items-center justify-center gap-1.5 py-2.5 text-[12px] font-semibold text-[#52b788]"
                onClick={() => update('services', [...(s.services ?? []), { label: '', price: '' }])}
              >
                <i className="bi bi-plus-circle-fill" /> Weitere Leistung hinzufügen
              </button>
            </SecAccordion>

            <SecAccordion icon="bi-file-earmark-pdf-fill" title="Rechnungsvorschau" hint="So sehen deine Rechnungen aus">
              <div className="rounded-lg border border-[#E5E2DC] bg-[#FAFAF8] p-4 text-[10px] text-[#6B7280] leading-relaxed">
                <div className="mb-2.5 flex justify-between">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#52b788] text-white text-[12px] font-bold">H</div>
                  <div className="text-right text-[8px]">
                    {s.companyName || `${s.firstName} ${s.lastName}`.trim() || 'Betrieb'}<br />
                    {[s.street, [s.zip, s.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}<br />
                    Tel: {s.phone || '…'}
                  </div>
                </div>
                <div className="text-[12px] font-bold text-[#1B1F23]">Rechnung</div>
                <div className="my-1 text-[8px]">{s.invoicePrefix ?? 'HUF-'}{s.nextInvoiceNumber ?? '2026-0001'} · Zahlungsziel: {s.paymentTerms ?? '7 Tage'}</div>
                <div className="my-2 text-[9px]">Kunde: [Name] · [Adresse]</div>
                <div className="flex justify-between py-1">
                  <span>Barhufbearbeitung (1 Pferd, 4 Hufe)</span>
                  <span>65,00 €</span>
                </div>
                <div className="flex justify-between border-t border-[#E5E2DC] py-1.5 font-bold text-[11px] text-[#52b788]">
                  <span>Gesamtbetrag</span>
                  <span>65,00 €</span>
                </div>
                {s.kleinunternehmer && (
                  <div className="mt-2 text-[8px]">{s.kleinunternehmerText ?? 'Gemäß §19 UStG …'}</div>
                )}
                <div className="mt-2 border-t border-[#E5E2DC] pt-2 text-center text-[8px]">
                  {s.companyName || [s.firstName, s.lastName].filter(Boolean).join(' ')} · {[s.street, [s.zip, s.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}<br />
                  IBAN: {s.iban ? `${s.iban.slice(0, 8)}…` : '…'} · {s.bank || '…'}
                </div>
              </div>
            </SecAccordion>
          </>
        )}

        {activeTab === 'benachrichtigungen' && (
          <SecAccordion open icon="bi-bell-fill" title="Benachrichtigungen">
            <div
              className="mb-3 flex items-center gap-3 rounded-lg px-3 py-2.5"
              style={{ background: 'rgba(82,183,136,.06)', border: '1px solid rgba(82,183,136,.15)' }}
            >
              <i className="bi bi-envelope-fill shrink-0 text-[20px] text-[#52b788]" aria-hidden />
              <div className="flex flex-1 flex-col">
                <span className="text-[12px] font-semibold">E-Mail-Erinnerungen</span>
                <span className="text-[10px] text-[#9CA3AF]">Terminerinnerungen per E-Mail an Kunden senden</span>
              </div>
              <button
                type="button"
                onClick={() => update('emailReminders', !s.emailReminders)}
                className={`h-6 w-11 shrink-0 rounded-full transition-colors ${s.emailReminders !== false ? 'bg-[#52b788]' : 'bg-[#D1D5DB]'}`}
                style={{ padding: 2 }}
              >
                <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${s.emailReminders !== false ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            <div className="mb-3 rounded-lg px-3 py-2.5" style={{ background: 'rgba(82,183,136,.06)', border: '1px solid rgba(82,183,136,.15)' }}>
              <div className="text-[12px] font-semibold text-[#1B1F23]">Standard bei neuen Terminen</div>
              <div className="text-[10px] text-[#9CA3AF] mb-2">Voreinstellung im Terminformular (Mobil und Desktop)</div>
              <select
                className="w-full rounded-[10px] border-[1.5px] border-[#cdcdd0] bg-[#fafafa] px-3 py-2.5 text-[14px]"
                disabled={s.emailReminders === false}
                value={
                  s.appointmentReminderDefaultMinutes == null
                    ? ''
                    : String(s.appointmentReminderDefaultMinutes)
                }
                onChange={(e) => {
                  const v = e.target.value
                  update('appointmentReminderDefaultMinutes', v === '' ? null : Number(v))
                }}
              >
                {APPOINTMENT_REMINDER_MINUTES_OPTIONS.map((o) => (
                  <option key={o.label} value={o.minutes == null ? '' : String(o.minutes)}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div
              className="mb-3 flex items-center gap-3 rounded-lg px-3 py-2.5"
              style={{ background: 'rgba(82,183,136,.06)', border: '1px solid rgba(82,183,136,.15)' }}
            >
              <i className="bi bi-phone-fill shrink-0 text-[20px] text-[#52b788]" aria-hidden />
              <div className="flex flex-1 flex-col">
                <span className="text-[12px] font-semibold">Push-Benachrichtigungen</span>
                <span className="text-[10px] text-[#9CA3AF]">Erinnerungen an anstehende Termine</span>
              </div>
              <button
                type="button"
                onClick={() => update('pushNotifications', !s.pushNotifications)}
                className={`h-6 w-11 shrink-0 rounded-full transition-colors ${s.pushNotifications !== false ? 'bg-[#52b788]' : 'bg-[#D1D5DB]'}`}
                style={{ padding: 2 }}
              >
                <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${s.pushNotifications !== false ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            <div
              className="mb-3 flex items-center gap-3 rounded-lg px-3 py-2.5"
              style={{ background: 'rgba(82,183,136,.06)', border: '1px solid rgba(82,183,136,.15)' }}
            >
              <i className="bi bi-calendar-event-fill shrink-0 text-[20px] text-[#52b788]" aria-hidden />
              <div className="flex flex-1 flex-col">
                <span className="text-[12px] font-semibold">Termin-Zusammenfassung</span>
                <span className="text-[10px] text-[#9CA3AF]">Tägliche Übersicht morgens per E-Mail</span>
              </div>
              <button
                type="button"
                onClick={() => update('dailySummary', !s.dailySummary)}
                className={`h-6 w-11 shrink-0 rounded-full transition-colors ${s.dailySummary ? 'bg-[#52b788]' : 'bg-[#D1D5DB]'}`}
                style={{ padding: 2 }}
              >
                <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${s.dailySummary ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </SecAccordion>
        )}

        {activeTab === 'konto' && (
          <SecAccordion open icon="bi-shield-lock-fill" title="Konto & Sicherheit">
            <FGroup label="E-Mail-Adresse">
              <input className={inputClass} value={s.email ?? ''} disabled style={{ opacity: 0.6 }} />
            </FGroup>
            <FGroup label="Passwort ändern">
              <input className={inputClass} type="password" placeholder="Neues Passwort eingeben" />
            </FGroup>
            <FGroup label="Passwort bestätigen">
              <input className={inputClass} type="password" placeholder="Neues Passwort wiederholen" />
            </FGroup>
            {canExportData && (
              <div className="mt-4 border-t border-[#F0EEEA] pt-4">
                <div className="text-[12px] font-semibold text-[#1B1F23]">Datenexport</div>
                <p className="mt-1 text-[11px] leading-relaxed text-[#6B7280]">
                  ZIP mit Tabellen (CSV/JSON) und Fotos — wie unter Billing.
                </p>
                <a
                  href="/api/export/full"
                  className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[12px] font-medium text-[#1B1F23]"
                  download
                >
                  <i className="bi bi-download" aria-hidden />
                  ZIP exportieren
                </a>
              </div>
            )}
            <div className="mt-4 border-t border-[#F0EEEA] pt-4">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#DC2626] cursor-pointer">
                <i className="bi bi-trash3-fill" /> Konto löschen
              </div>
              <div className="mt-1 text-[10px] text-[#9CA3AF]">Alle Daten werden unwiderruflich gelöscht.</div>
            </div>
          </SecAccordion>
        )}

        {/* Save Bar */}
        <div
          className="fixed left-0 right-0 flex items-center justify-between gap-4 px-4 py-3"
          style={{
            bottom: `calc(${tabH}px + ${safeBottom})`,
            background: 'rgba(255,255,255,.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(0,0,0,.06)',
            zIndex: 40,
          }}
        >
          <Link href="/dashboard" className="text-[14px] font-medium text-[#6B7280] hover:text-[#1B1F23]">
            Abbrechen
          </Link>
          <div className="flex items-center gap-3">
            {saved && <span className="text-[13px] text-[#34A853]">✓ Gespeichert</span>}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-[#52b788] px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#0f301b] disabled:opacity-60"
            >
              {saving ? 'Speichert…' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
