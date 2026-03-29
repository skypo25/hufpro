'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEllipsisVertical, faCheck, faClock, faBan, faPaperPlane } from '@fortawesome/free-solid-svg-icons'
import { updateInvoiceStatus } from '@/app/(app)/invoices/actions'

type InvoiceListRowWithMenuProps = {
  id: string
  invoiceNumber: string
  customerName: string
  invoiceDate: string
  sentAt?: string | null
  status: string
}

function formatDateShort(d: string | null | undefined) {
  if (!d) return '–'
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return d
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

const statusLabel = (s: string) =>
  s === 'paid' ? 'Bezahlt' : s === 'sent' ? 'Offen' : s === 'cancelled' ? 'Storniert' : 'Entwurf'

const statusClass = (s: string) =>
  s === 'paid'
    ? 'bg-[#DCFCE7] text-[#166534]'
    : s === 'sent'
      ? 'bg-[#FEF3C7] text-[#92400E]'
      : s === 'cancelled'
        ? 'bg-[#F3F4F6] text-[#9CA3AF]'
        : 'bg-[#F3F4F6] text-[#6B7280]'

export default function InvoiceListRowWithMenu({
  id,
  invoiceNumber,
  customerName,
  invoiceDate,
  sentAt,
  status,
}: InvoiceListRowWithMenuProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [sendingMail, setSendingMail] = useState(false)
  const [mailMsg, setMailMsg] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return
      if ((e.target as HTMLElement).closest('[data-invoice-menu-toggle]')) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const handleStatus = async (newStatus: 'paid' | 'sent' | 'cancelled') => {
    setOpen(false)
    setPending(true)
    const result = await updateInvoiceStatus(id, newStatus)
    setPending(false)
    if (!('error' in result)) router.refresh()
  }

  const handleResend = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (sendingMail) return
    setMailMsg(null)
    setSendingMail(true)
    try {
      const res = await fetch(`/api/invoices/${id}/send-email`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((json as { error?: string })?.error || 'E-Mail-Versand fehlgeschlagen')
      const to = (json as { to?: string })?.to
      setMailMsg(to ? `E-Mail an ${to} versendet.` : 'E-Mail versendet.')
      router.refresh()
    } catch (err) {
      setMailMsg(err instanceof Error ? err.message : 'E-Mail-Versand fehlgeschlagen')
    } finally {
      setSendingMail(false)
      window.setTimeout(() => setMailMsg(null), 6000)
    }
  }

  return (
    <div className="relative grid grid-cols-[140px_220px_1fr_120px_44px_52px] items-center gap-6 border-b border-[#E5E2DC] px-[22px] py-[14px] transition hover:bg-[rgba(21,66,38,0.03)] last:border-b-0 max-[700px]:grid-cols-[130px_1fr_120px_44px_52px] max-[700px]:[&>*:nth-child(2)]:hidden">
      <Link
        href={status === 'draft' ? `/invoices/${id}/edit` : `/invoices/${id}`}
        className="absolute inset-0 z-0"
        aria-label={`Rechnung ${invoiceNumber} öffnen`}
      />

      <div className="pointer-events-none z-10 min-w-0">
        <div className="text-[13px] text-[#6B7280] tabular-nums">
          {formatDateShort(invoiceDate)}
        </div>
        {sentAt ? (
          <div className="mt-0.5 truncate text-[11px] font-medium text-[#6B7280]">
            Gesendet: {formatDateShort(sentAt)}
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none z-10 min-w-0">
        <div className="truncate text-[13px] font-medium text-[#1B1F23]">{invoiceNumber}</div>
      </div>

      <div className="pointer-events-none z-10 min-w-0">
        <div className="truncate text-[13px] font-medium text-[#1B1F23]">{customerName}</div>
        {mailMsg && (
          <div className="mt-0.5 truncate text-[11px] text-[#6B7280]">
            {mailMsg}
          </div>
        )}
      </div>

      <div className="pointer-events-none z-10 flex justify-end pr-3">
        <span className={`rounded-full px-2.5 py-1 text-center text-[11px] font-medium ${statusClass(status)}`}>
          {statusLabel(status)}
        </span>
      </div>

      <div className="z-20 flex justify-end">
        <button
          type="button"
          onClick={handleResend}
          disabled={sendingMail || status === 'cancelled'}
          className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E2DC] bg-white text-[#6B7280] transition hover:border-[#52b788] hover:text-[#52b788] disabled:opacity-50"
          title={status === 'cancelled' ? 'Stornierte Rechnung' : (sentAt ? 'E-Mail erneut senden' : 'Per E-Mail senden')}
          aria-label={sentAt ? 'E-Mail erneut senden' : 'Per E-Mail senden'}
        >
          <FontAwesomeIcon icon={faPaperPlane} className="h-4 w-4" />
        </button>
      </div>

      <div className="z-20 flex justify-end">
        <div className="relative" ref={open ? menuRef : undefined}>
          <button
            type="button"
            data-invoice-menu-toggle
            onClick={(e) => {
              e.preventDefault()
              setOpen((v) => !v)
            }}
            disabled={pending}
            className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E2DC] bg-white text-[#6B7280] transition hover:border-[#52b788] hover:text-[#52b788] disabled:opacity-50"
            title="Status ändern"
            aria-expanded={open}
            aria-haspopup="true"
          >
            <FontAwesomeIcon icon={faEllipsisVertical} className="h-4 w-4" />
          </button>
          {open && (
            <div className="absolute right-0 top-full z-20 mt-1 min-w-[200px] rounded-lg border border-[#E5E2DC] bg-white py-1 shadow-lg">
              <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Status ändern</p>
              {status !== 'draft' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleStatus('paid')}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#1B1F23] hover:bg-[#FAF9F7]"
                  >
                    <FontAwesomeIcon icon={faCheck} className="h-3.5 w-3.5 text-[#34A853]" /> Als bezahlt markieren
                    {status === 'paid' && <span className="ml-auto text-[11px] text-[#9CA3AF]">Aktuell</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatus('sent')}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#1B1F23] hover:bg-[#FAF9F7]"
                  >
                    <FontAwesomeIcon icon={faClock} className="h-3.5 w-3.5 text-[#F59E0B]" /> Als offen markieren
                    {status === 'sent' && <span className="ml-auto text-[11px] text-[#9CA3AF]">Aktuell</span>}
                  </button>
                </>
              )}
              {status === 'draft' && (
                <p className="px-3 py-2 text-[12px] text-[#6B7280]">Entwurf: Zuerst speichern &amp; versenden.</p>
              )}
              <button
                type="button"
                onClick={() => handleStatus('cancelled')}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#1B1F23] hover:bg-[#FAF9F7]"
              >
                <FontAwesomeIcon icon={faBan} className="h-3.5 w-3.5 text-[#9CA3AF]" /> Stornieren
                {status === 'cancelled' && <span className="ml-auto text-[11px] text-[#9CA3AF]">Aktuell</span>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
