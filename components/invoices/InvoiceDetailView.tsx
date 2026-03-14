'use client'

import Link from 'next/link'
import type { InvoicePdfData } from '@/lib/pdf/invoiceTypes'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChevronLeft,
  faPrint,
  faFilePdf,
  faPaperPlane,
  faCheck,
} from '@fortawesome/free-solid-svg-icons'

function formatDate(d: string | null | undefined) {
  if (!d) return '–'
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return d
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }).format(date)
}

function formatDateShort(d: string | null | undefined) {
  if (!d) return '–'
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return d
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

function formatAddress(parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(', ') || '–'
}

type InvoiceDetailViewProps = {
  data: InvoicePdfData
  backHref: string
  invoiceId: string
  status: string
}

export default function InvoiceDetailView({ data, backHref, invoiceId, status }: InvoiceDetailViewProps) {
  const { seller, buyer, items, totalCents } = data
  const sellerName = seller.companyName?.trim() || seller.name
  const sellerAddress = formatAddress([seller.street, [seller.zip, seller.city].filter(Boolean).join(' '), seller.country])
  const buyerAddress = formatAddress([buyer.street, [buyer.zip, buyer.city].filter(Boolean).join(' '), buyer.country])

  const statusLabel = status === 'paid' ? 'Bezahlt' : status === 'sent' ? 'Offen' : status === 'cancelled' ? 'Storniert' : 'Entwurf'
  const statusClass =
    status === 'paid'
      ? 'bg-[#DCFCE7] text-[#166534]'
      : status === 'sent'
        ? 'bg-[#FEF3C7] text-[#92400E]'
        : status === 'cancelled'
          ? 'bg-[#F3F4F6] text-[#9CA3AF]'
          : 'bg-[#F3F4F6] text-[#6B7280]'

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#F7F6F3] px-5 py-10">
      {/* Toolbar - not printed */}
      <div className="mb-7 flex w-full max-w-[820px] flex-wrap items-center gap-3 print:hidden">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <Link
            href={backHref}
            className="flex items-center gap-1.5 text-[13px] font-medium text-[#154226] hover:underline"
          >
            <FontAwesomeIcon icon={faChevronLeft} className="h-4 w-4" />
            Zurück
          </Link>
          <span className="text-[#E5E2DC]">|</span>
          <span className="font-serif text-[18px] font-semibold text-[#1B1F23]">Rechnung {data.invoiceNumber}</span>
          <span className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold ${statusClass}`}>
            {status === 'paid' && <FontAwesomeIcon icon={faCheck} className="mr-1.5 h-3.5 w-3.5" />}
            {statusLabel}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5 text-[13px] font-medium text-[#1B1F23] transition-colors hover:border-[#154226] hover:text-[#154226]"
          >
            <FontAwesomeIcon icon={faPrint} className="h-4 w-4" />
            Drucken
          </button>
          <a
            href={`/invoices/${invoiceId}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5 text-[13px] font-medium text-[#1B1F23] transition-colors hover:border-[#154226] hover:text-[#154226]"
          >
            <FontAwesomeIcon icon={faFilePdf} className="h-4 w-4" />
            PDF herunterladen
          </a>
          <button
            type="button"
            className="huf-btn-dark inline-flex items-center gap-2 rounded-lg bg-[#154226] px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[#0f301b]"
          >
            <FontAwesomeIcon icon={faPaperPlane} className="h-4 w-4" />
            Per E-Mail senden
          </button>
        </div>
      </div>

      {/* Invoice card */}
      <div className="w-full max-w-[820px] overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-black/5">
        {/* Accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#154226] via-[#edf3ef] to-[#154226]" />

        <div className="p-10 md:p-12">
          {/* Header */}
          <div className="mb-10 flex flex-col gap-6 border-b-2 border-[#E5E2DC] pb-8 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-4">
              {seller.logoUrl ? (
                <img
                  src={seller.logoUrl}
                  alt="Logo"
                  className="h-16 w-16 shrink-0 rounded-2xl object-contain"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-[#E5E2DC] bg-black/[0.01]">
                  <span className="font-serif text-2xl font-bold text-[#154226]">
                    {(sellerName || seller.name).slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <div className="font-serif text-[22px] font-semibold tracking-tight text-[#1B1F23]">{sellerName}</div>
                <div className="mt-0.5 text-[13px] text-[#6B7280]">
                  {seller.name}
                  {seller.qualification ? ` · ${seller.qualification}` : ''}
                </div>
              </div>
            </div>
            <div className="text-left md:text-right">
              <div className="font-serif text-[32px] font-semibold tracking-tight text-[#154226]">Rechnung</div>
              <div className="mt-0.5 text-[14px] font-medium text-[#6B7280]">{data.invoiceNumber}</div>
            </div>
          </div>

          {/* Meta: Rechnungsempfänger + Rechnungsdaten */}
          <div className="mb-9 grid gap-8 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">
                Rechnungsempfänger
              </div>
              <div className="text-[14px] leading-relaxed text-[#1B1F23]">
                <strong>{buyer.name}</strong>
                {buyer.company && <><br />{buyer.company}</>}
                {buyerAddress !== '–' && <><br />{buyerAddress}</>}
                {buyer.country && buyerAddress !== '–' && <><br />{buyer.country}</>}
              </div>
            </div>
            <div className="text-left md:text-right">
              <div className="mb-2 flex items-center justify-end gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">
                Rechnungsdaten
              </div>
              <div className="text-[14px] leading-relaxed text-[#1B1F23]">
                {data.customerNumberDisplay && <><strong>Kundennummer:</strong> {data.customerNumberDisplay}<br /></>}
                <strong>Rechnungsnummer:</strong> {data.invoiceNumber}<br />
                <strong>Rechnungsdatum:</strong> {formatDate(data.invoiceDate)}<br />
                {(data.serviceDateFrom || data.serviceDateTo) && (
                  <><strong>Leistungsdatum:</strong> {formatDateShort(data.serviceDateFrom || data.serviceDateTo)}<br /></>
                )}
                <strong>Zahlungsziel:</strong> {data.paymentDueDate ? formatDate(data.paymentDueDate) : '–'}
              </div>
            </div>
          </div>

          {/* Table */}
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-[#E5E2DC] bg-black/[0.02]">
                <th className="py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Leistung</th>
                <th className="w-24 py-3 px-4 text-center text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Anzahl</th>
                <th className="w-28 py-3 px-4 text-right text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Einzelpreis</th>
                <th className="w-28 py-3 px-4 text-right text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Betrag</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-b border-[#E5E2DC]">
                  <td className="py-4 px-4">
                    <div className="font-semibold text-[#1B1F23]">{item.description}</div>
                  </td>
                  <td className="py-4 px-4 text-center text-[#6B7280]">{item.quantity}</td>
                  <td className="py-4 px-4 text-right tabular-nums">{formatCurrency(item.unitPriceCents)}</td>
                  <td className="py-4 px-4 text-right font-semibold tabular-nums">{formatCurrency(item.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary */}
          <div className="mt-6 flex justify-end">
            <div className="w-[300px]">
              <div className="flex justify-between py-2 text-[14px] text-[#6B7280]">
                <span>Zwischensumme</span>
                <span>{formatCurrency(totalCents)}</span>
              </div>
              <div className="flex justify-between py-2 text-[14px] text-[#6B7280]">
                <span>Umsatzsteuer</span>
                <span>entfällt (§19 UStG)</span>
              </div>
              <div className="mt-2 flex justify-between border-t-2 border-[#1B1F23] pt-4 text-[18px] font-bold">
                <span>Gesamtbetrag</span>
                <span className="text-[22px] text-[#154226]">{formatCurrency(totalCents)}</span>
              </div>
            </div>
          </div>

          {/* Kleinunternehmer */}
          {seller.kleinunternehmer && seller.kleinunternehmerText && (
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-[#154226]/20 bg-gradient-to-br from-[#154226]/10 to-[#154226]/5 px-5 py-3.5 text-[13px] text-[#0f301b]">
              {seller.kleinunternehmerText}
            </div>
          )}

          {/* Zahlungsinfo */}
          <div className="mt-6 grid gap-6 rounded-xl bg-black/[0.02] p-5 md:grid-cols-2">
            <div>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Bankverbindung</div>
              <div className="text-[13px] leading-relaxed text-[#1B1F23]">
                {seller.accountHolder && <><strong>{seller.accountHolder}</strong><br /></>}
                {seller.bank && <>{seller.bank}<br /></>}
                {seller.iban && <div className="mt-0.5 font-mono text-[14px] font-semibold tracking-wide">{seller.iban}</div>}
                {seller.bic && <div className="text-[13px]">BIC: {seller.bic}</div>}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Zahlungshinweis</div>
              <div className="text-[13px] leading-relaxed text-[#1B1F23]">
                {data.footerText || `Bitte überweisen Sie den Betrag unter Angabe der Rechnungsnummer ${data.invoiceNumber} auf das nebenstehende Konto.`}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 flex flex-col gap-4 border-t border-[#E5E2DC] pt-5 md:flex-row md:items-end md:justify-between">
            <div className="text-[11px] leading-relaxed text-[#9CA3AF]">
              {sellerName}{seller.name && sellerName !== seller.name ? ` · ${seller.name}` : ''}<br />
              {sellerAddress !== '–' && <>{sellerAddress}<br /></>}
              {seller.phone && <>Tel: {seller.phone}<br /></>}
              {seller.email && <>{seller.email}<br /></>}
              {seller.website && <>{seller.website}<br /></>}
              {seller.taxNumber && <>Steuernummer: {seller.taxNumber}{seller.taxOffice ? ` · ${seller.taxOffice}` : ''}<br /></>}
            </div>
            <div className="text-right">
              <div className="text-[10px] text-[#9CA3AF]">Erstellt mit <span className="font-serif font-semibold text-[#154226]">HufPro</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
