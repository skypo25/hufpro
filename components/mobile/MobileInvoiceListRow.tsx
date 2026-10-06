'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPaperPlane, faEllipsisVertical, faCheck, faClock, faBan } from '@fortawesome/free-solid-svg-icons'
import { updateInvoiceStatus } from '@/app/(app)/invoices/actions'
import { useToast } from '@/context/ToastContext'
import { useBottomSheetDrag } from '@/components/mobile/useBottomSheetDrag'

type InvoiceRow = {
  id: string
  invoiceNumber: string
  invoiceDate: string
  sentAt: string | null
  status: string
  customerName: string
  totalCents: number
}

function formatDate(d: string | null | undefined) {
  if (!d) return '–'
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return d
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function formatEuro(cents: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

function statusLabel(s: string) {
  return s === 'paid' ? 'Bezahlt' : s === 'sent' ? 'Offen' : s === 'cancelled' ? 'Storniert' : 'Entwurf'
}

function statusClass(s: string) {
  return s === 'paid'
    ? 'bg-[#DCFCE7] text-[#166534]'
    : s === 'sent'
      ? 'bg-[#FEF3C7] text-[#92400E]'
      : s === 'cancelled'
        ? 'bg-[#F3F4F6] text-[#9CA3AF]'
        : 'bg-[#F3F4F6] text-[#6B7280]'
}

export default function MobileInvoiceListRow({
  invoice,
  onUpdated,
}: {
  invoice: InvoiceRow
  onUpdated: (patch: Partial<InvoiceRow>) => void
}) {
  const { showToast } = useToast()
  const [sheet, setSheet] = useState<'status' | null>(null)
  const closeSheet = () => setSheet(null)
  const { offset, dragging, handleProps } = useBottomSheetDrag(closeSheet)
  const [pending, setPending] = useState(false)
  const [sendingMail, setSendingMail] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const href = invoice.status === 'draft' ? `/invoices/${invoice.id}/edit` : `/invoices/${invoice.id}`

  const handleStatus = async (newStatus: 'paid' | 'sent' | 'cancelled') => {
    setPending(true)
    const result = await updateInvoiceStatus(invoice.id, newStatus)
    setPending(false)
    if ('error' in result) {
      showToast(result.error, 'error')
      return
    }
    onUpdated({ status: newStatus })
    setSheet(null)
    showToast(
      newStatus === 'paid'
        ? 'Als bezahlt markiert.'
        : newStatus === 'cancelled'
          ? 'Rechnung storniert.'
          : 'Als offen markiert.'
    )
  }

  const sendInvoiceEmail = async () => {
    if (sendingMail) return
    setSendingMail(true)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/send-email`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((json as { error?: string })?.error || 'E-Mail-Versand fehlgeschlagen')
      const to = (json as { to?: string })?.to
      showToast(to ? `E-Mail an ${to} versendet.` : 'E-Mail versendet.')
      onUpdated({
        status: invoice.status === 'cancelled' || invoice.status === 'paid' ? invoice.status : 'sent',
        sentAt: new Date().toISOString(),
      })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'E-Mail-Versand fehlgeschlagen', 'error')
    } finally {
      setSendingMail(false)
    }
  }

  const sheetUi =
    sheet && mounted
      ? createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[90] bg-black/40"
              aria-label="Schließen"
              onClick={closeSheet}
            />
            <div
              className="fixed inset-x-0 bottom-0 z-[100] mx-auto w-full max-w-[430px] rounded-t-2xl bg-white px-4 pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-8px_32px_rgba(0,0,0,0.12)]"
              style={{
                transform: `translateY(${offset}px)`,
                transition: dragging ? 'none' : 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
              }}
            >
              <div className="mx-auto mb-3 flex touch-none justify-center py-1" {...handleProps}>
                <span className="block h-1 w-9 rounded-full bg-[#D1D5DB]" aria-hidden />
              </div>
              <p className="mb-2 text-[13px] font-semibold text-[#1A1A1A]">Status ändern</p>
              {invoice.status === 'draft' ? (
                <p className="py-2 text-[13px] text-[#6B7280]">Entwurf: zuerst speichern und versenden.</p>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void handleStatus('paid')}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left text-[14px] text-[#1A1A1A] active:bg-black/[0.03]"
                  >
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4 text-[#34A853]" />
                    Als bezahlt markieren
                    {invoice.status === 'paid' ? (
                      <span className="ml-auto text-[11px] text-[#9CA3AF]">Aktuell</span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void handleStatus('sent')}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left text-[14px] text-[#1A1A1A] active:bg-black/[0.03]"
                  >
                    <FontAwesomeIcon icon={faClock} className="h-4 w-4 text-[#F59E0B]" />
                    Als offen markieren
                    {invoice.status === 'sent' ? (
                      <span className="ml-auto text-[11px] text-[#9CA3AF]">Aktuell</span>
                    ) : null}
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => void handleStatus('cancelled')}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left text-[14px] text-[#1A1A1A] active:bg-black/[0.03]"
              >
                <FontAwesomeIcon icon={faBan} className="h-4 w-4 text-[#9CA3AF]" />
                Stornieren
                {invoice.status === 'cancelled' ? (
                  <span className="ml-auto text-[11px] text-[#9CA3AF]">Aktuell</span>
                ) : null}
              </button>
            </div>
          </>,
          document.body
        )
      : null

  return (
    <div className="rounded-[12px] border border-[#F0EEEA] bg-white">
      <div className="flex items-center gap-2 px-3 py-3">
        <Link href={href} className="min-w-0 flex-1 active:opacity-80">
          <div className="truncate text-[14px] font-semibold text-[#1A1A1A]">{invoice.invoiceNumber}</div>
          <div className="truncate text-[12px] text-[#6B7280]">
            {invoice.customerName} · {formatDate(invoice.invoiceDate)}
          </div>
          {invoice.sentAt ? (
            <div className="mt-0.5 truncate text-[11px] text-[#6B7280]">Gesendet: {formatDate(invoice.sentAt)}</div>
          ) : null}
        </Link>
        <div className="shrink-0 text-right">
          <div className="text-[14px] font-semibold tabular-nums text-primary">{formatEuro(invoice.totalCents)}</div>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass(invoice.status)}`}>
            {statusLabel(invoice.status)}
          </span>
        </div>
      </div>
      <div className="flex gap-2 border-t border-[#F0EEEA] px-3 py-2">
        <button
          type="button"
          onClick={() => void sendInvoiceEmail()}
          disabled={invoice.status === 'cancelled' || sendingMail}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#E5E2DC] text-[12px] font-medium text-[#1A1A1A] disabled:opacity-40"
          aria-label={invoice.sentAt ? 'E-Mail erneut senden' : 'Per E-Mail senden'}
        >
          <FontAwesomeIcon icon={faPaperPlane} className="h-3.5 w-3.5 text-primary" />
          {invoice.sentAt ? 'Erneut senden' : 'Senden'}
        </button>
        <button
          type="button"
          onClick={() => setSheet('status')}
          disabled={pending}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#E5E2DC] text-[12px] font-medium text-[#1A1A1A] disabled:opacity-40"
          aria-label="Status ändern"
        >
          <FontAwesomeIcon icon={faEllipsisVertical} className="h-3.5 w-3.5 text-[#6B7280]" />
          Status
        </button>
      </div>
      {sheetUi}
    </div>
  )
}
