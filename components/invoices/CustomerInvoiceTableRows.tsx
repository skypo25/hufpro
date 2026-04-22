'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFilePdf, faEllipsisVertical, faCheck, faClock, faBan } from '@fortawesome/free-solid-svg-icons'
import { updateInvoiceStatus } from '@/app/(app)/invoices/actions'

export type InvoiceRowData = {
  id: string
  invoice_number: string
  invoice_date: string
  payment_due_date: string | null
  status: string
  totalCents: number
  firstDesc: string
  statusLabel: string
  statusClass: string
  overdue: boolean
}

type CustomerInvoiceTableRowsProps = {
  rows: InvoiceRowData[]
  horseNames: string
}

function formatDate(d: string | null) {
  if (!d) return '–'
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return d
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

type MenuPosition = { top: number; right: number }

export default function CustomerInvoiceTableRows({ rows, horseNames }: CustomerInvoiceTableRowsProps) {
  const router = useRouter()
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openMenuId) {
      setMenuPosition(null)
      return
    }
    const measure = () => {
      const btn = document.querySelector(`[data-invoice-menu-toggle][data-invoice-id="${openMenuId}"]`) as HTMLElement | null
      if (!btn) return
      const rect = btn.getBoundingClientRect()
      setMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    measure()
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target)) return
      if ((e.target as HTMLElement).closest('[data-invoice-menu-toggle]')) return
      setOpenMenuId(null)
    }
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [openMenuId])

  const handleStatusChange = async (invoiceId: string, status: 'paid' | 'sent' | 'cancelled') => {
    setOpenMenuId(null)
    setPendingId(invoiceId)
    const result = await updateInvoiceStatus(invoiceId, status)
    setPendingId(null)
    if ('error' in result) return
    router.refresh()
  }

  return (
    <>
      {rows.map((inv) => (
        <div
          key={inv.id}
          className={`grid grid-cols-[48px_130px_1fr_110px_100px_80px] gap-3 border-b border-[#E5E2DC] px-4 py-4 transition last:border-b-0 md:grid-cols-[48px_130px_1fr_140px_110px_100px_80px] ${inv.overdue ? 'bg-[rgba(239,68,68,0.03)]' : 'hover:bg-[rgba(1,85,85,0.03)]'}`}
        >
          <Link
            href={inv.status === 'draft' ? `/invoices/${inv.id}/edit` : `/invoices/${inv.id}`}
            className="contents group"
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${inv.overdue ? 'bg-[#FEE2E2]' : inv.status === 'paid' ? 'bg-[#DCFCE7]' : inv.status === 'draft' ? 'bg-[#F3F4F6]' : 'bg-[#FEF3C7]'}`}>
              <div className={`h-3 w-3 rounded-full ${inv.overdue ? 'bg-[#EF4444]' : inv.status === 'paid' ? 'bg-[#34A853]' : 'bg-[#9CA3AF]'}`} />
            </div>
            <div>
              <div className="text-[13px] font-semibold tabular-nums text-[#006d6d] group-hover:underline">{inv.invoice_number}</div>
              <div className="text-[11px] text-[#9CA3AF]">{formatDate(inv.invoice_date)}</div>
            </div>
            <div className="min-w-0">
              <div className="truncate text-[14px] font-medium text-[#1B1F23]">{inv.firstDesc}</div>
              {horseNames ? <div className="truncate text-[12px] text-[#6B7280]">🐴 {horseNames}</div> : null}
            </div>
            <div className="text-right font-serif text-[17px] font-semibold tabular-nums text-[#006d6d]">{formatCurrency(inv.totalCents)}</div>
            <div className="flex items-center justify-center">
              <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${inv.statusClass}`}>{inv.statusLabel}</span>
            </div>
          </Link>
          <div className="flex items-center justify-end gap-1" ref={openMenuId === inv.id ? menuRef : undefined}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                window.open(`/invoices/${inv.id}/pdf`, '_blank')
              }}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E2DC] text-[#6B7280] transition hover:border-[#006d6d] hover:text-[#006d6d]"
              title="PDF"
            >
              <FontAwesomeIcon icon={faFilePdf} className="h-3.5 w-3.5" />
            </button>
            <div className="relative">
              <button
                type="button"
                data-invoice-menu-toggle
                data-invoice-id={inv.id}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setOpenMenuId(openMenuId === inv.id ? null : inv.id)
                }}
                disabled={pendingId === inv.id}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E2DC] text-[#6B7280] transition hover:border-[#006d6d] hover:text-[#006d6d] disabled:opacity-50"
                title="Optionen"
                aria-expanded={openMenuId === inv.id}
                aria-haspopup="true"
              >
                <FontAwesomeIcon icon={faEllipsisVertical} className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
      {openMenuId && menuPosition && typeof document !== 'undefined' && (() => {
        const openRow = rows.find((r) => r.id === openMenuId)
        if (!openRow) return null
        const menu = (
          <div
            ref={menuRef}
            className="fixed z-50 min-w-[200px] rounded-lg border border-[#E5E2DC] bg-white py-1 shadow-lg"
            style={{ top: menuPosition.top, right: menuPosition.right }}
          >
            <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Status ändern</p>
            {openRow.status !== 'draft' && (
              <>
                <button
                  type="button"
                  onClick={() => handleStatusChange(openRow.id, 'paid')}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#1B1F23] hover:bg-[#FAF9F7]"
                >
                  <FontAwesomeIcon icon={faCheck} className="h-3.5 w-3.5 shrink-0 text-[#34A853]" />
                  <span>Als bezahlt markieren</span>
                  {openRow.status === 'paid' && <span className="ml-auto text-[11px] text-[#9CA3AF]">Aktuell</span>}
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(openRow.id, 'sent')}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#1B1F23] hover:bg-[#FAF9F7]"
                >
                  <FontAwesomeIcon icon={faClock} className="h-3.5 w-3.5 shrink-0 text-[#F59E0B]" />
                  <span>Als offen markieren</span>
                  {openRow.status === 'sent' && <span className="ml-auto text-[11px] text-[#9CA3AF]">Aktuell</span>}
                </button>
              </>
            )}
            {openRow.status === 'draft' && (
              <p className="px-3 py-2 text-[12px] text-[#6B7280]">Entwurf: Zuerst speichern &amp; versenden.</p>
            )}
            <button
              type="button"
              onClick={() => handleStatusChange(openRow.id, 'cancelled')}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#1B1F23] hover:bg-[#FAF9F7]"
            >
              <FontAwesomeIcon icon={faBan} className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
              <span>Stornieren</span>
              {openRow.status === 'cancelled' && <span className="ml-auto text-[11px] text-[#9CA3AF]">Aktuell</span>}
            </button>
          </div>
        )
        return createPortal(menu, document.body)
      })()}
    </>
  )
}
