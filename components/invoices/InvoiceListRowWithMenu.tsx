'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEllipsisVertical, faCheck, faClock, faBan } from '@fortawesome/free-solid-svg-icons'
import { updateInvoiceStatus } from '@/app/(app)/invoices/actions'

type InvoiceListRowWithMenuProps = {
  id: string
  invoiceNumber: string
  customerName: string
  invoiceDate: string
  status: string
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
  status,
}: InvoiceListRowWithMenuProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
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

  return (
    <li className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[#FAF9F7]">
      <Link href={status === 'draft' ? `/invoices/${id}/edit` : `/invoices/${id}`} className="flex flex-1 flex-wrap items-center gap-4 min-w-0">
        <span className="font-mono text-[14px] font-semibold text-[#154226]">{invoiceNumber}</span>
        <span className="text-[14px] text-[#1B1F23]">{customerName}</span>
      </Link>
      <div className="flex items-center gap-4">
        <span className="text-[13px] text-[#6B7280]">{invoiceDate}</span>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusClass(status)}`}>
          {statusLabel(status)}
        </span>
        <div className="relative" ref={open ? menuRef : undefined}>
          <button
            type="button"
            data-invoice-menu-toggle
            onClick={(e) => { e.preventDefault(); setOpen((v) => !v) }}
            disabled={pending}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E2DC] text-[#6B7280] transition hover:border-[#154226] hover:text-[#154226] disabled:opacity-50"
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
    </li>
  )
}
