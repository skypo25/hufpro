'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatCustomerNumber } from '@/lib/format'
import { formatGermanDate } from '@/lib/format'

const STORAGE_KEY = 'anidocs-recent-searches'
const MAX_RECENT = 10

type SearchFilter = 'alle' | 'kunden' | 'pferde' | 'termine' | 'dokumentationen' | 'rechnungen'

type SearchResponse = {
  counts: { customers: number; horses: number; appointments: number; hoofRecords: number; invoices: number }
  customers: Array<{
    id: string
    customer_number?: number | null
    name: string | null
    first_name?: string | null
    last_name?: string | null
    phone: string | null
    email: string | null
    city?: string | null
  }>
  horses: Array<{
    id: string
    name: string | null
    breed: string | null
    birth_year?: number | null
    customer_id: string | null
    customers?: { name: string | null } | { name: string | null }[] | null
  }>
  appointments: Array<{
    id: string
    appointment_date: string | null
    notes: string | null
    type: string | null
    customer_id: string | null
    customers?: { name: string | null } | null
  }>
  hoofRecords: Array<{
    id: string
    horse_id: string
    record_date: string | null
    hoof_condition: string | null
    treatment: string | null
    notes: string | null
    doc_number?: string | null
    horses?: { name: string | null; customers?: { name: string | null } | null } | null
  }>
  invoices: Array<{
    id: string
    invoice_number: string
    invoice_date: string
    status: string
    customer_id: string | null
    customers?: { name: string | null } | null
  }>
}

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}

function addRecentSearch(term: string) {
  if (!term?.trim()) return
  const recent = getRecentSearches().filter((s) => s.toLowerCase() !== term.trim().toLowerCase())
  recent.unshift(term.trim())
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)))
  } catch {
    /* ignore */
  }
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={20} height={20}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function IconChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

const FILTERS: { key: SearchFilter; label: string; countKey: keyof SearchResponse['counts'] }[] = [
  { key: 'alle', label: 'Alle', countKey: 'customers' },
  { key: 'kunden', label: 'Kunden', countKey: 'customers' },
  { key: 'pferde', label: 'Pferde', countKey: 'horses' },
  { key: 'termine', label: 'Termine', countKey: 'appointments' },
  { key: 'dokumentationen', label: 'Dokumentationen', countKey: 'hoofRecords' },
  { key: 'rechnungen', label: 'Rechnungen', countKey: 'invoices' },
]

export default function MobileSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQ = (searchParams.get('q') ?? '').trim()
  const initialFilter = (searchParams.get('filter') ?? 'alle') as SearchFilter

  const [q, setQ] = useState(initialQ)
  const [filter, setFilter] = useState<SearchFilter>(initialFilter)
  const [debouncedQ, setDebouncedQ] = useState(initialQ)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [data, setData] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setRecentSearches(getRecentSearches())
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQ(q), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [q])

  useEffect(() => {
    const params = new URLSearchParams()
    if (debouncedQ) params.set('q', debouncedQ)
    params.set('filter', filter)
    if (initialQ !== debouncedQ || initialFilter !== filter) {
      router.replace(`/suche?${params.toString()}`, { scroll: false })
    }
  }, [debouncedQ, filter, router, initialQ, initialFilter])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (debouncedQ) params.set('q', debouncedQ)
    params.set('filter', filter)
    try {
      const res = await fetch(`/api/search?${params}`, { credentials: 'include' })
      if (!res.ok) return
      const json = await res.json()
      setData(json)
    } finally {
      setLoading(false)
    }
  }, [debouncedQ, filter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (q.trim()) addRecentSearch(q.trim())
    setRecentSearches(getRecentSearches())
  }

  function handleFilterClick(f: SearchFilter) {
    setFilter(f)
  }

  function handleRecentClick(term: string) {
    setQ(term)
    addRecentSearch(term)
    setRecentSearches(getRecentSearches())
    inputRef.current?.focus()
  }

  const hasQuery = debouncedQ.length > 0
  const counts = data?.counts ?? { customers: 0, horses: 0, appointments: 0, hoofRecords: 0, invoices: 0 }
  const totalResults =
    (filter === 'alle' || filter === 'kunden' ? (data?.customers?.length ?? 0) : 0) +
    (filter === 'alle' || filter === 'pferde' ? (data?.horses?.length ?? 0) : 0) +
    (filter === 'alle' || filter === 'termine' ? (data?.appointments?.length ?? 0) : 0) +
    (filter === 'alle' || filter === 'dokumentationen' ? (data?.hoofRecords?.length ?? 0) : 0) +
    (filter === 'alle' || filter === 'rechnungen' ? (data?.invoices?.length ?? 0) : 0)

  return (
    <>
      <div className="status-bar" aria-hidden />
      <header className="mobile-header">
        <div className="ah-top">
          <div>
            <h1 className="mobile-greeting">Suche</h1>
            <div className="mobile-sub">
              Kunden, Pferde, Termine, Dokumentationen und Rechnungen
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="mobile-search-wrap">
          <IconSearch />
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Suchen…"
            className="mobile-search-input"
            aria-label="Suchen"
            autoComplete="off"
          />
        </form>
      </header>

      <div className="mobile-content">
        <div className="customer-filters" role="tablist">
          {FILTERS.map((f) => {
            const count = counts[f.countKey]
            const isActive = filter === f.key
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`customer-filter-chip ${isActive ? 'active' : ''}`}
                onClick={() => handleFilterClick(f.key)}
              >
                {f.key === 'alle' ? f.label : `${f.label} (${count})`}
              </button>
            )
          })}
        </div>

        {!hasQuery && recentSearches.length > 0 && (
          <section className="mt-4">
            <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[#9CA3AF]">
              Letzte Suchen
            </h2>
            <div className="flex flex-col gap-0.5">
              {recentSearches.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => handleRecentClick(term)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[14px] text-[#1B1F23] hover:bg-[#f7f7f7]"
                >
                  <IconClock />
                  {term}
                </button>
              ))}
            </div>
          </section>
        )}

        {hasQuery && (
          <>
            {loading ? (
              <div className="py-8 text-center text-[14px] text-[#6B7280]">Suchen…</div>
            ) : (
              <>
                <p className="mt-2 text-[13px] text-[#6B7280]">
                  {totalResults === 0 ? 'Keine Treffer gefunden.' : `${totalResults} Treffer`}
                </p>

                <div className="mt-4 space-y-6">
                  {(filter === 'alle' || filter === 'kunden') && (data?.customers?.length ?? 0) > 0 && (
                    <section>
                      <h2 className="mb-2 text-[13px] font-semibold text-[#1B1F23]">
                        Kunden ({data!.customers.length})
                      </h2>
                      <div className="flex flex-col gap-2">
                        {data!.customers.map((c) => (
                          <Link
                            key={c.id}
                            href={`/customers/${c.id}`}
                            className="flex items-center justify-between rounded-xl border border-[#E5E2DC] bg-white p-3"
                          >
                            <div>
                              <div className="font-medium">
                                {c.name || [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Ohne Namen'}
                              </div>
                              {c.customer_number != null && (
                                <div className="text-[12px] text-[#6B7280]">
                                  {formatCustomerNumber(c.customer_number)}
                                </div>
                              )}
                            </div>
                            <IconChevronRight />
                          </Link>
                        ))}
                      </div>
                    </section>
                  )}

                  {(filter === 'alle' || filter === 'pferde') && (data?.horses?.length ?? 0) > 0 && (
                    <section>
                      <h2 className="mb-2 text-[13px] font-semibold text-[#1B1F23]">
                        Pferde ({data!.horses.length})
                      </h2>
                      <div className="flex flex-col gap-2">
                        {data!.horses.map((h) => {
                          const cust = Array.isArray(h.customers) ? h.customers?.[0] : h.customers
                          const custName = cust?.name ?? null
                          return (
                            <Link
                              key={h.id}
                              href={`/animals/${h.id}`}
                              className="flex items-center justify-between rounded-xl border border-[#E5E2DC] bg-white p-3"
                            >
                              <div>
                                <div className="font-medium">{h.name || 'Ohne Namen'}</div>
                                <div className="text-[12px] text-[#6B7280]">
                                  {[h.breed, h.birth_year ? `geb. ${h.birth_year}` : null, custName]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </div>
                              </div>
                              <IconChevronRight />
                            </Link>
                          )
                        })}
                      </div>
                    </section>
                  )}

                  {(filter === 'alle' || filter === 'termine') && (data?.appointments?.length ?? 0) > 0 && (
                    <section>
                      <h2 className="mb-2 text-[13px] font-semibold text-[#1B1F23]">
                        Termine ({data!.appointments.length})
                      </h2>
                      <div className="flex flex-col gap-2">
                        {data!.appointments.map((a) => {
                          const cust = Array.isArray(a.customers) ? a.customers?.[0] : a.customers
                          const custName = cust?.name ?? 'Kunde'
                          return (
                            <Link
                              key={a.id}
                              href={`/appointments/${a.id}`}
                              className="flex items-center justify-between rounded-xl border border-[#E5E2DC] bg-white p-3"
                            >
                              <div>
                                <div className="font-medium">
                                  {a.appointment_date ? formatGermanDate(a.appointment_date) : 'Ohne Datum'}
                                  {a.type && (
                                    <span className="ml-1 text-[12px] font-normal text-[#6B7280]">
                                      · {a.type}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[12px] text-[#6B7280]">{custName}</div>
                              </div>
                              <IconChevronRight />
                            </Link>
                          )
                        })}
                      </div>
                    </section>
                  )}

                  {(filter === 'alle' || filter === 'dokumentationen') && (data?.hoofRecords?.length ?? 0) > 0 && (
                    <section>
                      <h2 className="mb-2 text-[13px] font-semibold text-[#1B1F23]">
                        Dokumentationen ({data!.hoofRecords.length})
                      </h2>
                      <div className="flex flex-col gap-2">
                        {data!.hoofRecords.map((r) => {
                          const horse = Array.isArray(r.horses) ? r.horses?.[0] : r.horses
                          const horseName = horse?.name ?? 'Pferd'
                          const cust = horse && 'customers' in horse
                            ? (Array.isArray((horse as { customers?: unknown }).customers)
                                ? (horse as { customers?: { name: string | null }[] }).customers?.[0]
                                : (horse as { customers?: { name: string | null } }).customers)
                            : null
                          const custName = cust?.name ?? null
                          return (
                            <Link
                              key={r.id}
                              href={`/animals/${r.horse_id}/records/${r.id}`}
                              className="flex items-center justify-between rounded-xl border border-[#E5E2DC] bg-white p-3"
                            >
                              <div>
                                <div className="font-medium">
                                  {r.record_date ? formatGermanDate(r.record_date) : 'Ohne Datum'}
                                  {r.doc_number && (
                                    <span className="ml-1 text-[12px] font-normal text-[#6B7280]">
                                      · {r.doc_number}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[12px] text-[#6B7280]">
                                  {horseName}
                                  {custName && ` · ${custName}`}
                                </div>
                              </div>
                              <IconChevronRight />
                            </Link>
                          )
                        })}
                      </div>
                    </section>
                  )}

                  {(filter === 'alle' || filter === 'rechnungen') && (data?.invoices?.length ?? 0) > 0 && (
                    <section>
                      <h2 className="mb-2 text-[13px] font-semibold text-[#1B1F23]">
                        Rechnungen ({data!.invoices.length})
                      </h2>
                      <div className="flex flex-col gap-2">
                        {data!.invoices.map((inv) => {
                          const cust = Array.isArray(inv.customers) ? inv.customers?.[0] : inv.customers
                          const custName = cust?.name ?? 'Kunde'
                          return (
                            <Link
                              key={inv.id}
                              href={`/customers/${inv.customer_id}/invoices`}
                              className="flex items-center justify-between rounded-xl border border-[#E5E2DC] bg-white p-3"
                            >
                              <div>
                                <div className="font-medium">
                                  {inv.invoice_number}
                                  <span className="ml-1 text-[12px] font-normal text-[#6B7280]">
                                    · {formatGermanDate(inv.invoice_date)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-[12px] text-[#6B7280]">
                                  <span>{custName}</span>
                                  <span
                                    className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                                      inv.status === 'paid'
                                        ? 'bg-green-100 text-green-800'
                                        : inv.status === 'sent'
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {inv.status === 'paid' ? 'Bezahlt' : inv.status === 'sent' ? 'Versendet' : 'Entwurf'}
                                  </span>
                                </div>
                              </div>
                              <IconChevronRight />
                            </Link>
                          )
                        })}
                      </div>
                    </section>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}
