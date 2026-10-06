'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import MobileInvoiceListRow from '@/components/mobile/MobileInvoiceListRow'

type InvoiceRow = {
  id: string
  invoiceNumber: string
  invoiceDate: string
  sentAt: string | null
  status: string
  customerId: string | null
  customerName: string
  totalCents: number
}

type StatusFilter = 'all' | 'open' | 'paid'

const PAGE_SIZE = 20

function formatEuro(cents: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={20} height={20}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

export default function MobileInvoices({ customerId }: { customerId?: string }) {
  const searchParams = useSearchParams()
  const customerIdFromQuery = searchParams.get('customerId')?.trim() || ''
  const scopedCustomerId = customerId || customerIdFromQuery

  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [openTotalCents, setOpenTotalCents] = useState(0)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQ(q), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [q])

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      const params = new URLSearchParams()
      if (debouncedQ) params.set('q', debouncedQ)
      params.set('status', status)
      if (scopedCustomerId) params.set('customerId', scopedCustomerId)
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String(offset))
      const res = await fetch(`/api/invoices/mobile?${params}`, { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      const next = (data.invoices ?? []) as InvoiceRow[]
      setInvoices((prev) => (append ? [...prev, ...next] : next))
      setOpenTotalCents(data.openTotalCents ?? 0)
      setTotal(data.total ?? next.length)
      setHasMore(Boolean(data.hasMore))
    },
    [debouncedQ, status, scopedCustomerId]
  )

  useEffect(() => {
    setLoading(true)
    fetchPage(0, false).finally(() => setLoading(false))
  }, [fetchPage])

  const loadMore = async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      await fetchPage(invoices.length, true)
    } finally {
      setLoadingMore(false)
    }
  }

  const newHref = scopedCustomerId ? `/invoices/new?customerId=${scopedCustomerId}` : '/invoices/new'

  return (
    <>
      <div className="status-bar" aria-hidden />
      <header className="mobile-header">
        <div className="ah-top">
          <div>
            <h1 className="mobile-greeting">Rechnungen</h1>
            <div className="mobile-sub">
              Offen: {formatEuro(openTotalCents)}
              {!loading && total > 0 ? ` · ${total} gesamt` : ''}
            </div>
          </div>
          <Link href={newHref} className="ah-btn" aria-label="Neue Rechnung">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={20} height={20}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </Link>
        </div>
        <div className="mobile-search-wrap">
          <IconSearch />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nummer oder Kunde…"
            className="mobile-search-input"
            aria-label="Rechnungen suchen"
          />
        </div>
      </header>

      <div className="mobile-content">
        <div className="customer-filters" role="tablist">
          {(
            [
              { key: 'all', label: 'Alle' },
              { key: 'open', label: 'Offen' },
              { key: 'paid', label: 'Bezahlt' },
            ] as const
          ).map((chip) => (
            <button
              key={chip.key}
              type="button"
              role="tab"
              aria-selected={status === chip.key}
              className={`customer-filter-chip ${status === chip.key ? 'active' : ''}`}
              onClick={() => setStatus(chip.key)}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="py-8 text-center text-[14px] text-[#6B7280]">Rechnungen werden geladen…</p>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <p className="text-[15px] font-medium text-[#1B1F23]">Noch keine Rechnungen</p>
            <p className="mt-1 text-[13px] text-[#6B7280]">Schreibe deine erste Rechnung für einen Kunden.</p>
            <Link href={newHref} className="primary-button mt-5">
              Neue Rechnung
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2 pb-4">
            {invoices.map((inv) => (
              <MobileInvoiceListRow
                key={inv.id}
                invoice={inv}
                onUpdated={(patch) => {
                  setInvoices((prev) => prev.map((row) => (row.id === inv.id ? { ...row, ...patch } : row)))
                }}
              />
            ))}
            {hasMore ? (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="mt-2 rounded-xl border border-[#E5E2DC] bg-white py-3 text-[13px] font-semibold text-[#1A1A1A] disabled:opacity-50"
              >
                {loadingMore ? 'Lädt…' : 'Weitere laden'}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </>
  )
}
