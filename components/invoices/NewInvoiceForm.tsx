'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronRight, faCheck, faFilePdf, faPaperPlane, faPlus, faUser } from '@fortawesome/free-solid-svg-icons'
import { createInvoice } from '@/app/(app)/invoices/new/actions'
import { updateInvoice } from '@/app/(app)/invoices/[id]/edit/actions'

function priceStringToCents(s: string): number {
  const cleaned = String(s).replace(/[^\d,.-]/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  if (Number.isNaN(num)) return 0
  return Math.round(num * 100)
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

function formatDate(d: string): string {
  if (!d) return '–'
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return d
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

type Customer = {
  id: string
  name: string | null
  first_name: string | null
  last_name: string | null
  company: string | null
  street: string | null
  postal_code: string | null
  city: string | null
  country: string | null
  email: string | null
}

type Horse = { id: string; name: string | null; breed: string | null }
type Service = { label: string; price: string }

type LineItem = {
  id: string
  description: string
  optionalSuffix: string
  horseId: string
  quantity: number
  unitPriceCents: number
  amountCents: number
}

type CustomerStats = {
  totalInvoices: number
  totalCents: number
  openCents: number
  lastInvoiceDate: string | null
}

const inputClass =
  'w-full rounded-lg border border-[#E5E2DC] bg-white px-3.5 py-2.5 text-sm text-[#1B1F23] outline-none focus:border-[#154226] focus:ring-2 focus:ring-[#154226]/10'
const selectClass = inputClass + ' appearance-none bg-[right_14px_center] bg-no-repeat pr-10 cursor-pointer'

export default function NewInvoiceForm({
  customers,
  initialCustomer,
  horses: initialHorses,
  customerStats,
  services,
  invoiceNumber,
  nextInvoiceNumber,
  defaultIntroText,
  defaultFooterText,
  sellerName,
  sellerAddress,
  editMode,
}: {
  customers: Customer[]
  initialCustomer: (Customer & { name: string }) | null
  horses: Horse[]
  customerStats: CustomerStats | null
  services: Service[]
  invoiceNumber: string
  nextInvoiceNumber: string
  defaultIntroText: string
  defaultFooterText: string
  sellerName: string
  sellerAddress: string
  editMode?: {
    invoiceId: string
    customerId: string
    backHref: string
    initialInvoiceDate: string
    initialServiceDate: string
    initialPaymentDueDays: number
    initialLineItems: LineItem[]
  }
}) {
  const router = useRouter()
  const isEdit = !!editMode
  const [selectedCustomer, setSelectedCustomer] = useState<(Customer & { name: string }) | null>(initialCustomer)
  const [horses, setHorses] = useState<Horse[]>(initialHorses)
  const [invoiceDate, setInvoiceDate] = useState(() =>
    isEdit && editMode ? editMode.initialInvoiceDate : new Date().toISOString().slice(0, 10)
  )
  const [serviceDate, setServiceDate] = useState(() =>
    isEdit && editMode ? editMode.initialServiceDate : new Date().toISOString().slice(0, 10)
  )
  const [paymentDueDays, setPaymentDueDays] = useState(isEdit && editMode ? editMode.initialPaymentDueDays : 7)
  const [introText, setIntroText] = useState(defaultIntroText)
  const [footerText, setFooterText] = useState(defaultFooterText)
  const [personalNote, setPersonalNote] = useState('')
  const [lineItems, setLineItems] = useState<LineItem[]>(() => {
    if (isEdit && editMode?.initialLineItems?.length) {
      return editMode.initialLineItems.map((i) => ({ ...i, id: i.id || crypto.randomUUID() }))
    }
    return [
      {
        id: crypto.randomUUID(),
        description: '',
        optionalSuffix: '',
        horseId: '',
        quantity: 1,
        unitPriceCents: 0,
        amountCents: 0,
      },
    ]
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Beim Bearbeiten des Betragsfelds: Zeile + aktueller Text (damit Eingabe nicht sofort zu "6,00" wird) */
  const [editingAmount, setEditingAmount] = useState<{ rowId: string; text: string } | null>(null)

  const paymentDueDate = (() => {
    const d = new Date(invoiceDate)
    d.setDate(d.getDate() + paymentDueDays)
    return d.toISOString().slice(0, 10)
  })()

  const totalCents = lineItems.reduce((s, i) => s + i.amountCents, 0)

  const onCustomerChange = useCallback(
    (customerId: string) => {
      if (!customerId) {
        setSelectedCustomer(null)
        setHorses([])
        return
      }
      const c = customers.find((x) => x.id === customerId)
      if (!c) return
      const name = c.name?.trim() || [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || 'Kunde'
      setSelectedCustomer({ ...c, name })
      fetch(`/api/customers/${customerId}/horses`)
        .then((r) => r.json())
        .then((data: Horse[]) => setHorses(Array.isArray(data) ? data : []))
        .catch(() => setHorses([]))
    },
    [customers]
  )

  const addLineItem = useCallback(() => {
    setLineItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        description: '',
        optionalSuffix: '',
        horseId: '',
        quantity: 1,
        unitPriceCents: 0,
        amountCents: 0,
      },
    ])
  }, [])

  const updateLineItem = useCallback((id: string, upd: Partial<LineItem>) => {
    setLineItems((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row
        const next = { ...row, ...upd }
        if (upd.quantity != null || upd.unitPriceCents != null) {
          next.amountCents = (next.quantity || 1) * (next.unitPriceCents ?? 0)
        }
        return next
      })
    )
  }, [])

  const removeLineItem = useCallback((id: string) => {
    setLineItems((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const setLineItemFromService = useCallback(
    (index: number, service: Service) => {
      const cents = priceStringToCents(service.price)
      const row = lineItems[index]
      if (!row) return
      updateLineItem(row.id, {
        description: service.label,
        unitPriceCents: cents,
        quantity: 1,
        amountCents: cents,
      })
    },
    [lineItems, updateLineItem]
  )

  const handleSaveDraft = async () => {
    if (!selectedCustomer) {
      setError('Bitte einen Kunden auswählen.')
      return
    }
    if (lineItems.length === 0) {
      setError('Bitte mindestens eine Position anlegen.')
      return
    }
    if (lineItems.some((i) => !i.description.trim() || i.amountCents <= 0)) {
      setError('Bitte alle Positionen ausfüllen und Beträge prüfen.')
      return
    }
    setError(null)
    setSaving(true)
    const buyerName = selectedCustomer.name
    const payload = {
      invoice_date: invoiceDate,
      service_date_from: serviceDate,
      payment_due_date: paymentDueDate,
      intro_text: introText.trim() || null,
      footer_text: footerText.trim() || null,
      buyer_name: buyerName,
      buyer_company: selectedCustomer.company?.trim() || null,
      buyer_street: selectedCustomer.street?.trim() || null,
      buyer_zip: selectedCustomer.postal_code?.trim() || null,
      buyer_city: selectedCustomer.city?.trim() || null,
      buyer_country: selectedCustomer.country?.trim() || null,
      items: lineItems.map((i) => ({
        description: i.description + (i.optionalSuffix?.trim() ? ' — ' + i.optionalSuffix.trim() : ''),
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
        amountCents: i.amountCents,
      })),
    }
    let result: { invoiceId: string } | { error: string }
    if (isEdit && editMode) {
      result = await updateInvoice(editMode.invoiceId, editMode.customerId, { ...payload, status: 'draft' })
      setSaving(false)
      if ('error' in result) {
        setError(result.error)
        return
      }
      router.push(editMode.backHref || `/invoices/${result.invoiceId}`)
      return
    }
    result = await createInvoice(selectedCustomer.id, {
      invoice_number: invoiceNumber,
      ...payload,
    })
    setSaving(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    router.push(`/invoices/${result.invoiceId}`)
  }

  const handleSaveAsSent = async () => {
    if (!selectedCustomer || !isEdit || !editMode) return
    if (lineItems.length === 0) {
      setError('Bitte mindestens eine Position anlegen.')
      return
    }
    if (lineItems.some((i) => !i.description.trim() || i.amountCents <= 0)) {
      setError('Bitte alle Positionen ausfüllen und Beträge prüfen.')
      return
    }
    setError(null)
    setSaving(true)
    const buyerName = selectedCustomer.name
    const payload = {
      invoice_date: invoiceDate,
      service_date_from: serviceDate,
      payment_due_date: paymentDueDate,
      intro_text: introText.trim() || null,
      footer_text: footerText.trim() || null,
      buyer_name: buyerName,
      buyer_company: selectedCustomer.company?.trim() || null,
      buyer_street: selectedCustomer.street?.trim() || null,
      buyer_zip: selectedCustomer.postal_code?.trim() || null,
      buyer_city: selectedCustomer.city?.trim() || null,
      buyer_country: selectedCustomer.country?.trim() || null,
      items: lineItems.map((i) => ({
        description: i.description + (i.optionalSuffix?.trim() ? ' — ' + i.optionalSuffix.trim() : ''),
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
        amountCents: i.amountCents,
      })),
    }
    const result = await updateInvoice(editMode.invoiceId, editMode.customerId, { ...payload, status: 'sent' })
    setSaving(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    router.push(editMode.backHref || `/invoices/${result.invoiceId}`)
  }

  const buyerAddress = selectedCustomer
    ? [selectedCustomer.street, [selectedCustomer.postal_code, selectedCustomer.city].filter(Boolean).join(' '), selectedCustomer.country]
        .filter(Boolean)
        .join(', ') || '–'
    : '–'

  return (
    <div className="grid grid-cols-1 gap-7 lg:grid-cols-[1fr_360px]">
      {/* Left column */}
      <div className="space-y-5">
        {/* 1. Rechnungsempfänger */}
        <section className="overflow-hidden rounded-xl border border-[#E5E2DC] bg-white shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-[#E5E2DC] px-5 py-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#edf3ef] text-[#154226]">
              <FontAwesomeIcon icon={faUser} className="h-4 w-4" />
            </span>
            <h3 className="font-serif text-[15px] font-medium text-[#1B1F23]">Rechnungsempfänger</h3>
          </div>
          <div className="p-5">
            {selectedCustomer ? (
              <>
                <div className="flex items-center justify-between gap-4 rounded-xl border-2 border-[#154226] bg-[#154226]/[0.04] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#154226] text-sm font-semibold text-white">
                      {selectedCustomer.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-[#1B1F23]">{selectedCustomer.name}</div>
                      <div className="text-xs text-[#6B7280]">
                        {[selectedCustomer.street, [selectedCustomer.postal_code, selectedCustomer.city].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}
                        {horses.length ? ` · ${horses.length} Pferd${horses.length > 1 ? 'e' : ''}` : ''}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(null)}
                    className="text-sm font-semibold text-[#154226] hover:underline"
                  >
                    Ändern
                  </button>
                </div>
                <p className="mt-3 flex items-start gap-2 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] p-3 text-xs leading-relaxed text-[#1E40AF]">
                  <span className="shrink-0">ℹ️</span>
                  Rechnungsadresse wird aus den Kundendaten übernommen.
                </p>
              </>
            ) : (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Kunde wählen</label>
                <select
                  value=""
                  onChange={(e) => onCustomerChange(e.target.value)}
                  className={selectClass}
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%239CA3AF' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")` }}
                >
                  <option value="">Bitte wählen…</option>
                  {customers.map((c) => {
                    const name = c.name?.trim() || [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || 'Kunde'
                    return (
                      <option key={c.id} value={c.id}>
                        {name}
                      </option>
                    )
                  })}
                </select>
                {customers.length === 0 && (
                  <p className="mt-2 text-sm text-[#6B7280]">
                    <Link href="/customers" className="text-[#154226] hover:underline">
                      Kunden anlegen
                    </Link>
                    , um eine Rechnung zu erstellen.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* 2. Rechnungsdaten */}
        <section className="overflow-hidden rounded-xl border border-[#E5E2DC] bg-white shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-[#E5E2DC] px-5 py-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#DBEAFE] text-[#2563EB]">📄</span>
            <h3 className="font-serif text-[15px] font-medium text-[#1B1F23]">Rechnungsdaten</h3>
            <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-[#34A853]">
              <FontAwesomeIcon icon={faCheck} className="h-3 w-3" /> Automatisch ausgefüllt
            </span>
          </div>
          <div className="grid gap-5 p-5 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Rechnungsnummer</label>
              <input type="text" value={invoiceNumber} readOnly className={inputClass + ' bg-[#FAF9F7] font-semibold text-[#154226]'} />
              <p className="mt-1 text-[11px] text-[#9CA3AF]">Wird automatisch hochgezählt</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Rechnungsdatum</label>
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Leistungsdatum</label>
              <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className={inputClass} />
              <p className="mt-1 text-[11px] text-[#9CA3AF]">Tag der Behandlung</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Zahlungsziel</label>
              <select
                value={paymentDueDays}
                onChange={(e) => setPaymentDueDays(Number(e.target.value))}
                className={selectClass}
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%239CA3AF' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")` }}
              >
                <option value={0}>Sofort fällig</option>
                <option value={7}>7 Tage ({formatDate(paymentDueDate)})</option>
                <option value={14}>14 Tage</option>
                <option value={30}>30 Tage</option>
              </select>
            </div>
          </div>
        </section>

        {/* 3. Positionen */}
        <section className="overflow-hidden rounded-xl border border-[#E5E2DC] bg-white shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-[#E5E2DC] px-5 py-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#DCFCE7] text-[#166534]">✂️</span>
            <h3 className="font-serif text-[15px] font-medium text-[#1B1F23]">Rechnungspositionen</h3>
          </div>
          <div className="p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Schnellauswahl aus deinem Leistungskatalog:</p>
            <div className="mb-5 flex flex-wrap gap-2">
              {services.map((svc, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setLineItemFromService(0, svc)}
                  className="rounded-lg border border-[#E5E2DC] bg-white px-3.5 py-2 text-xs font-medium text-[#6B7280] transition-colors hover:border-[#154226] hover:text-[#154226]"
                >
                  {svc.label} · {svc.price}
                </button>
              ))}
            </div>

            <div className="overflow-hidden rounded-xl border border-[#E5E2DC]">
              <div className="grid grid-cols-[1fr_120px_70px_100px_44px] gap-3 border-b border-[#E5E2DC] bg-black/[0.02] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                <div>Leistung</div>
                <div>Pferd</div>
                <div className="text-center">Anz.</div>
                <div className="text-right">Betrag</div>
                <div />
              </div>
              {lineItems.map((row) => {
                const isFreeInput = !services.some((s) => s.label === row.description)
                return (
                <div
                  key={row.id}
                  className="grid grid-cols-[1fr_120px_70px_100px_44px] gap-3 border-b border-[#E5E2DC] px-4 py-3 last:border-b-0"
                >
                  <div className="space-y-2">
                    <select
                      value={isFreeInput ? '__free__' : row.description}
                      onChange={(e) => {
                        const opt = e.target.value
                        const svc = services.find((s) => s.label === opt)
                        if (svc) {
                          const cents = priceStringToCents(svc.price)
                          updateLineItem(row.id, { description: svc.label, unitPriceCents: cents, amountCents: cents })
                        } else {
                          updateLineItem(row.id, { description: '', optionalSuffix: '' })
                        }
                      }}
                      className={selectClass + ' text-[14px]'}
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%239CA3AF' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")` }}
                    >
                      <option value="__free__">Freier Text</option>
                      {services.map((s) => (
                        <option key={s.label} value={s.label}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    {isFreeInput ? (
                      <>
                        <input
                          type="text"
                          placeholder="Leistung oder Beschreibung eingeben"
                          value={row.description}
                          onChange={(e) => updateLineItem(row.id, { description: e.target.value })}
                          className={inputClass + ' text-[14px]'}
                        />
                        <input
                          type="text"
                          placeholder="Optionale Beschreibung…"
                          value={row.optionalSuffix}
                          onChange={(e) => updateLineItem(row.id, { optionalSuffix: e.target.value })}
                          className={inputClass + ' text-[14px]'}
                        />
                      </>
                    ) : (
                      <input
                        type="text"
                        placeholder="Optionale Beschreibung…"
                        value={row.optionalSuffix}
                        onChange={(e) => updateLineItem(row.id, { optionalSuffix: e.target.value })}
                        className={inputClass + ' text-[14px]'}
                      />
                    )}
                  </div>
                  <div>
                    <select
                      value={row.horseId}
                      onChange={(e) => updateLineItem(row.id, { horseId: e.target.value })}
                      className={selectClass + ' text-[14px]'}
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%239CA3AF' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")` }}
                    >
                      <option value="">—</option>
                      {horses.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name || '–'} {h.breed ? `(${h.breed})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-start">
                    <input
                      type="number"
                      min={1}
                      value={row.quantity}
                      onChange={(e) => updateLineItem(row.id, { quantity: Number(e.target.value) || 1 })}
                      className={inputClass + ' text-center font-semibold'}
                    />
                  </div>
                  <div className="flex items-start justify-end">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={
                        editingAmount?.rowId === row.id
                          ? editingAmount.text
                          : row.amountCents === 0
                            ? ''
                            : (row.amountCents / 100).toFixed(2).replace('.', ',')
                      }
                      onFocus={() =>
                        setEditingAmount({
                          rowId: row.id,
                          text: row.amountCents === 0 ? '' : (row.amountCents / 100).toFixed(2).replace('.', ','),
                        })
                      }
                      onChange={(e) =>
                        setEditingAmount((prev) =>
                          prev?.rowId === row.id ? { rowId: row.id, text: e.target.value } : prev
                        )
                      }
                      onBlur={() => {
                        const text = editingAmount?.rowId === row.id ? editingAmount.text : ''
                        const cents = priceStringToCents(text)
                        const q = Math.max(1, row.quantity)
                        updateLineItem(row.id, {
                          amountCents: cents,
                          unitPriceCents: q > 0 ? Math.round(cents / q) : 0,
                        })
                        setEditingAmount(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const text = editingAmount?.rowId === row.id ? editingAmount.text : ''
                          const cents = priceStringToCents(text)
                          const q = Math.max(1, row.quantity)
                          updateLineItem(row.id, {
                            amountCents: cents,
                            unitPriceCents: q > 0 ? Math.round(cents / q) : 0,
                          })
                          setEditingAmount(null)
                          ;(e.target as HTMLInputElement).blur()
                        }
                      }}
                      placeholder="0,00"
                      className={inputClass + ' w-full text-right font-serif text-[17px] font-semibold text-[#154226] tabular-nums'}
                    />
                  </div>
                  <div className="flex items-end justify-center">
                    <button
                      type="button"
                      onClick={() => removeLineItem(row.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-[#9CA3AF] hover:border-[#EF4444] hover:text-[#EF4444]"
                      title="Entfernen"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
              })}
              <div className="p-3 text-center">
                <button
                  type="button"
                  onClick={addLineItem}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#E5E2DC] py-2.5 text-[13px] font-semibold text-[#154226] transition-colors hover:border-[#154226] hover:bg-[#154226]/5"
                >
                  <FontAwesomeIcon icon={faPlus} className="h-4 w-4" /> Position hinzufügen
                </button>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <div className="w-[300px]">
                <div className="flex justify-between py-2 text-[14px] text-[#6B7280]">
                  <span>Zwischensumme</span>
                  <span>{formatCurrency(totalCents)}</span>
                </div>
                <div className="flex justify-between py-2 text-[14px] italic text-[#6B7280]">
                  <span>Umsatzsteuer</span>
                  <span>entfällt (§19 UStG)</span>
                </div>
                <div className="flex justify-between border-t-2 border-[#1B1F23] py-3 text-[18px] font-bold">
                  <span>Gesamtbetrag</span>
                  <span className="font-serif text-[24px] text-[#154226] tabular-nums">{formatCurrency(totalCents)}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#154226]/20 bg-[#154226]/5 p-3 text-[12px] text-[#0f301b]">
              <span className="shrink-0">ℹ️</span>
              Gemäß §19 UStG wird keine Umsatzsteuer berechnet.
            </div>
          </div>
        </section>

        {/* 4. Texte & Notizen */}
        <section className="overflow-hidden rounded-xl border border-[#E5E2DC] bg-white shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-[#E5E2DC] px-5 py-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F3F4F6] text-[#6B7280]">💬</span>
            <h3 className="font-serif text-[15px] font-medium text-[#1B1F23]">Texte & Notizen</h3>
          </div>
          <div className="space-y-5 p-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Einleitungstext</label>
              <textarea rows={2} value={introText} onChange={(e) => setIntroText(e.target.value)} className={inputClass + ' min-h-[70px]'} />
              <p className="mt-1 text-[11px] text-[#9CA3AF]">Aus deinen Voreinstellungen übernommen</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Schlusstext / Zahlungshinweis</label>
              <textarea rows={2} value={footerText} onChange={(e) => setFooterText(e.target.value)} className={inputClass + ' min-h-[70px]'} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Persönliche Notiz (optional)</label>
              <textarea
                rows={2}
                value={personalNote}
                onChange={(e) => setPersonalNote(e.target.value)}
                placeholder="z. B. Der nächste Termin ist voraussichtlich am … geplant."
                className={inputClass + ' min-h-[70px]'}
              />
            </div>
          </div>
        </section>
      </div>

      {/* Right sidebar */}
      <div className="space-y-5">
        {/* Vorschau */}
        <div className="overflow-hidden rounded-xl border-l-4 border-l-[#154226] border-[#E5E2DC] bg-white shadow-sm">
          <div className="border-b border-[#E5E2DC] px-5 py-4">
            <h4 className="font-serif text-[15px] font-medium text-[#1B1F23]">Vorschau</h4>
          </div>
          <div className="p-4">
            <div className="overflow-hidden rounded-xl border border-[#E5E2DC] text-[12px]">
              <div className="h-1 bg-gradient-to-r from-[#154226] to-[#edf3ef]" />
              <div className="p-4">
                <div className="mb-3 flex justify-between border-b border-[#E5E2DC] pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#edf3ef] font-serif text-[14px] font-bold text-[#154226]">
                      {sellerName.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-serif font-semibold text-[#154226]">Rechnung</span>
                  </div>
                  <div className="text-right text-[10px] text-[#6B7280]">
                    <strong className="text-[11px] text-[#1B1F23]">{sellerName}</strong>
                    <br />
                    {sellerAddress}
                  </div>
                </div>
                <div className="mb-2">
                  <div className="text-[9px] uppercase tracking-wider text-[#9CA3AF]">An</div>
                  <div className="font-semibold">{selectedCustomer?.name ?? '–'}</div>
                  <div className="text-[11px] text-[#6B7280]">{buyerAddress}</div>
                </div>
                <div className="mb-2 flex justify-between text-[10px] text-[#6B7280]">
                  <span>{invoiceNumber}</span>
                  <span>{formatDate(invoiceDate)}</span>
                </div>
                <div className="border-t border-[#E5E2DC] pt-2">
                  {lineItems.slice(0, 3).map((i) => (
                    <div key={i.id} className="flex justify-between py-1 text-[11px]">
                      <span>{i.description}</span>
                      <span className="font-semibold tabular-nums">{formatCurrency(i.amountCents)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between border-t-2 border-[#1B1F23] py-2 font-bold text-[13px]">
                  <span>Gesamt</span>
                  <span className="font-serif text-[16px] text-[#154226] tabular-nums">{formatCurrency(totalCents)}</span>
                </div>
                <div className="mt-2 rounded bg-[#edf3ef] px-2 py-1 text-center text-[9px] text-[#0f301b]">
                  Gemäß §19 UStG wird keine Umsatzsteuer berechnet.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Zusammenfassung */}
        <div className="overflow-hidden rounded-xl border border-[#E5E2DC] bg-white shadow-sm">
          <div className="border-b border-[#E5E2DC] px-5 py-4">
            <h4 className="font-serif text-[15px] font-medium text-[#1B1F23]">Zusammenfassung</h4>
          </div>
          <div className="p-5">
            <div className="space-y-2 border-b border-black/5 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Kunde</span>
                <span className="font-medium">{selectedCustomer?.name ?? '–'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Rechnung Nr.</span>
                <span className="font-semibold text-[#154226]">{invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Datum</span>
                <span>{formatDate(invoiceDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Zahlungsziel</span>
                <span>{formatDate(paymentDueDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Positionen</span>
                <span>{lineItems.length}</span>
              </div>
            </div>
            <div className="flex justify-between border-t-2 border-[#1B1F23] pt-4 mt-2 text-[15px] font-bold">
              <span className="text-[#1B1F23]">Gesamtbetrag</span>
              <span className="font-serif text-[24px] text-[#154226] tabular-nums">{formatCurrency(totalCents)}</span>
            </div>
          </div>
        </div>

        {/* Kundenhistorie */}
        {customerStats && selectedCustomer && (
          <div className="overflow-hidden rounded-xl border border-[#E5E2DC] bg-white shadow-sm">
            <div className="border-b border-[#E5E2DC] px-5 py-4">
              <h4 className="font-serif text-[15px] font-medium text-[#1B1F23]">Kundenhistorie</h4>
            </div>
            <div className="space-y-2 p-5 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Rechnungen gesamt</span>
                <span>{customerStats.totalInvoices}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Umsatz gesamt</span>
                <span className="text-[#154226]">{formatCurrency(customerStats.totalCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Offene Beträge</span>
                <span className={customerStats.openCents ? 'text-[#F59E0B]' : 'text-[#34A853]'}>
                  {formatCurrency(customerStats.openCents)} {customerStats.openCents === 0 ? '✓' : ''}
                </span>
              </div>
              {customerStats.lastInvoiceDate && (
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Letzte Rechnung</span>
                  <span>{formatDate(customerStats.lastInvoiceDate)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#E5E2DC] pt-6 lg:col-span-2">
        <div className="flex gap-3">
          <Link
            href={isEdit && editMode ? editMode.backHref : '/invoices'}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-medium text-[#6B7280] hover:bg-black/5"
          >
            <FontAwesomeIcon icon={faChevronRight} className="h-4 w-4 rotate-180" /> {isEdit ? 'Zurück' : 'Abbrechen'}
          </Link>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving || !selectedCustomer}
            className="rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5 text-[14px] font-medium text-[#1B1F23] hover:bg-[#FAF9F7] disabled:opacity-50"
          >
            Als Entwurf speichern
          </button>
        </div>
        <div className="flex gap-3">
          <span className="inline-flex items-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5 text-[14px] font-medium text-[#9CA3AF]">
            <FontAwesomeIcon icon={faFilePdf} className="h-4 w-4" /> PDF-Vorschau (nach Speichern)
          </span>
          <button
            type="button"
            onClick={isEdit ? handleSaveAsSent : handleSaveDraft}
            disabled={saving || !selectedCustomer}
            className="huf-btn-dark inline-flex items-center gap-2 rounded-lg bg-[#154226] px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-[#0f301b] disabled:opacity-50"
          >
            <FontAwesomeIcon icon={faCheck} className="h-4 w-4" /> {isEdit ? 'Speichern & als versendet markieren' : 'Rechnung erstellen'}
          </button>
          {!isEdit && (
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving || !selectedCustomer}
              className="huf-btn-dark inline-flex items-center gap-2 rounded-lg bg-[#34A853] px-5 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-[#2E9148] disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faPaperPlane} className="h-4 w-4" /> Erstellen & senden
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 lg:col-span-2">
          {error}
        </div>
      )}
    </div>
  )
}
