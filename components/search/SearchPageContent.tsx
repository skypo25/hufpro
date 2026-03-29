'use client'

import { useRef, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'
import { formatCustomerNumber } from '@/lib/format'
import { formatGermanDate } from '@/lib/format'

const STORAGE_KEY = 'anidocs-recent-searches'
const MAX_RECENT = 10

export type SearchFilter = 'alle' | 'kunden' | 'pferde' | 'termine' | 'dokumentationen' | 'rechnungen'

export type SearchPageContentProps = {
  initialQuery: string
  initialFilter: SearchFilter
  counts: {
    customers: number
    horses: number
    appointments: number
    hoofRecords: number
    invoices: number
  }
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

const FILTERS: { key: SearchFilter; label: string; icon: string; countKey: keyof SearchPageContentProps['counts'] }[] = [
  { key: 'alle', label: 'Alle', icon: 'bi-grid-3x3-gap', countKey: 'customers' },
  { key: 'kunden', label: 'Kunden', icon: 'bi-person', countKey: 'customers' },
  { key: 'pferde', label: 'Pferde', icon: 'bi-heart-pulse', countKey: 'horses' },
  { key: 'termine', label: 'Termine', icon: 'bi-folder', countKey: 'appointments' },
  { key: 'dokumentationen', label: 'Dokumentationen', icon: 'bi-file-earmark-text', countKey: 'hoofRecords' },
  { key: 'rechnungen', label: 'Rechnungen', icon: 'bi-receipt', countKey: 'invoices' },
]

export default function SearchPageContent({
  initialQuery,
  initialFilter,
  counts,
  customers,
  horses,
  appointments,
  hoofRecords,
  invoices,
}: SearchPageContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [query, setQuery] = useState(initialQuery)

  useEffect(() => {
    setRecentSearches(getRecentSearches())
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (q) addRecentSearch(q)
    const params = new URLSearchParams(searchParams.toString())
    params.set('q', q || '')
    params.set('filter', initialFilter)
    router.push(`/suche?${params.toString()}`)
  }

  function handleFilterClick(filter: SearchFilter) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('filter', filter)
    if (query.trim()) params.set('q', query.trim())
    router.push(`/suche?${params.toString()}`)
  }

  function handleRecentClick(term: string) {
    setQuery(term)
    addRecentSearch(term)
    const params = new URLSearchParams(searchParams.toString())
    params.set('q', term)
    params.set('filter', initialFilter)
    router.push(`/suche?${params.toString()}`)
  }

  const hasQuery = initialQuery.length > 0
  const totalResults =
    (initialFilter === 'alle' || initialFilter === 'kunden' ? customers.length : 0) +
    (initialFilter === 'alle' || initialFilter === 'pferde' ? horses.length : 0) +
    (initialFilter === 'alle' || initialFilter === 'termine' ? appointments.length : 0) +
    (initialFilter === 'alle' || initialFilter === 'dokumentationen' ? hoofRecords.length : 0) +
    (initialFilter === 'alle' || initialFilter === 'rechnungen' ? invoices.length : 0)

  return (
    <main className="mx-auto max-w-[1280px] w-full space-y-8">
      <PageHeader
        title="Suche"
        description="Durchsuche Kunden, Pferde, Termine, Dokumentationen und Rechnungen"
      />

      <form onSubmit={handleSubmit} className="w-full">
        <div className="flex items-center gap-2 rounded-xl border border-[#E5E2DC] bg-white px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-[#52b788]/30">
          <svg className="h-[18px] w-[18px] shrink-0 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen…"
            className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-[#1B1F23] outline-none placeholder:text-[#9CA3AF]"
            autoComplete="off"
            aria-label="Suche"
          />
          <kbd className="hidden rounded border border-[#E5E2DC] bg-[#f7f7f7] px-2 py-1 text-[11px] text-[#6B7280] sm:inline">
            ⌘K
          </kbd>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = counts[f.countKey]
          const isActive = initialFilter === f.key
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => handleFilterClick(f.key)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-medium transition ${
                isActive
                  ? 'bg-[#52b788] text-white shadow-sm'
                  : 'border border-[#E5E2DC] bg-white text-[#1B1F23] hover:border-[#52b788]/50'
              }`}
            >
              <i className={`bi ${f.icon} text-[15px]`} />
              {f.label}
              {f.key !== 'alle' && (
                <span className={isActive ? 'text-white/90' : 'text-[#6B7280]'}>
                  ({count})
                </span>
              )}
            </button>
          )
        })}
      </div>

      {!hasQuery && recentSearches.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-[#9CA3AF]">
            <i className="bi bi-clock text-[12px]" />
            Letzte Suchen
          </h2>
          <ul className="flex flex-col gap-1">
            {recentSearches.map((term) => (
              <li key={term}>
                <button
                  type="button"
                  onClick={() => handleRecentClick(term)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[14px] text-[#1B1F23] hover:bg-[#f7f7f7]"
                >
                  <i className="bi bi-clock text-[13px] text-[#9CA3AF]" />
                  {term}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasQuery && (
        <>
          <p className="text-[14px] text-[#6B7280]">
            {totalResults === 0
              ? 'Keine Treffer gefunden.'
              : `${totalResults} Treffer`}
          </p>

          <div className="space-y-8">
            {(initialFilter === 'alle' || initialFilter === 'kunden') && (
              <SearchSection
                title="Kunden"
                icon="bi-person"
                count={customers.length}
              >
                {customers.map((c) => (
                  <Link
                    key={c.id}
                    href={`/customers/${c.id}`}
                    className="block rounded-xl border border-[#E5E2DC] bg-white p-4 transition hover:border-[#52b788]/50 hover:shadow-sm"
                  >
                    <div className="font-medium text-[#1B1F23]">
                      {c.name || [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Ohne Namen'}
                    </div>
                    {c.customer_number != null && (
                      <div className="mt-1 text-[12px] text-[#6B7280]">
                        {formatCustomerNumber(c.customer_number)}
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap gap-x-4 text-[13px] text-[#6B7280]">
                      {c.phone && <span>{c.phone}</span>}
                      {c.email && <span>{c.email}</span>}
                      {c.city && <span>{c.city}</span>}
                    </div>
                  </Link>
                ))}
              </SearchSection>
            )}

            {(initialFilter === 'alle' || initialFilter === 'pferde') && (
              <SearchSection
                title="Pferde"
                icon="bi-heart-pulse"
                count={horses.length}
              >
                {horses.map((h) => {
                  const cust = Array.isArray(h.customers) ? h.customers?.[0] : h.customers
                  const custName = cust?.name ?? null
                  return (
                    <Link
                      key={h.id}
                      href={`/animals/${h.id}`}
                      className="block rounded-xl border border-[#E5E2DC] bg-white p-4 transition hover:border-[#52b788]/50 hover:shadow-sm"
                    >
                      <div className="font-medium text-[#1B1F23]">
                        {h.name || 'Ohne Namen'}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 text-[13px] text-[#6B7280]">
                        {h.breed && <span>Rasse: {h.breed}</span>}
                        {h.birth_year && (
                          <span>Geboren: {h.birth_year}</span>
                        )}
                        {custName && <span>Besitzer: {custName}</span>}
                      </div>
                    </Link>
                  )
                })}
              </SearchSection>
            )}

            {(initialFilter === 'alle' || initialFilter === 'termine') && (
              <SearchSection
                title="Termine"
                icon="bi-folder"
                count={appointments.length}
              >
                {appointments.map((a) => {
                  const cust = Array.isArray(a.customers) ? a.customers?.[0] : a.customers
                  const custName = cust?.name ?? 'Kunde'
                  return (
                    <Link
                      key={a.id}
                      href={`/appointments/${a.id}`}
                      className="block rounded-xl border border-[#E5E2DC] bg-white p-4 transition hover:border-[#52b788]/50 hover:shadow-sm"
                    >
                      <div className="font-medium text-[#1B1F23]">
                        {a.appointment_date
                          ? formatGermanDate(a.appointment_date)
                          : 'Ohne Datum'}
                        {a.type && (
                          <span className="ml-2 text-[13px] font-normal text-[#6B7280]">
                            · {a.type}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[13px] text-[#6B7280]">{custName}</div>
                      {a.notes && (
                        <div className="mt-1 line-clamp-2 text-[13px] text-[#6B7280]">
                          {a.notes}
                        </div>
                      )}
                    </Link>
                  )
                })}
              </SearchSection>
            )}

            {(initialFilter === 'alle' || initialFilter === 'dokumentationen') && (
              <SearchSection
                title="Dokumentationen"
                icon="bi-file-earmark-text"
                count={hoofRecords.length}
              >
                {hoofRecords.map((r) => {
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
                      className="block rounded-xl border border-[#E5E2DC] bg-white p-4 transition hover:border-[#52b788]/50 hover:shadow-sm"
                    >
                      <div className="font-medium text-[#1B1F23]">
                        {r.record_date ? formatGermanDate(r.record_date) : 'Ohne Datum'}
                        {r.doc_number && (
                          <span className="ml-2 text-[13px] font-normal text-[#6B7280]">
                            · {r.doc_number}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[13px] text-[#6B7280]">
                        {horseName}
                        {custName && ` · ${custName}`}
                      </div>
                      {(r.hoof_condition || r.treatment || r.notes) && (
                        <div className="mt-1 line-clamp-2 text-[13px] text-[#6B7280]">
                          {[r.hoof_condition, r.treatment, r.notes].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </Link>
                  )
                })}
              </SearchSection>
            )}

            {(initialFilter === 'alle' || initialFilter === 'rechnungen') && (
              <SearchSection
                title="Rechnungen"
                icon="bi-receipt"
                count={invoices.length}
              >
                {invoices.map((inv) => {
                  const cust = Array.isArray(inv.customers) ? inv.customers?.[0] : inv.customers
                  const custName = cust?.name ?? 'Kunde'
                  return (
                    <Link
                      key={inv.id}
                      href={`/customers/${inv.customer_id}/invoices`}
                      className="block rounded-xl border border-[#E5E2DC] bg-white p-4 transition hover:border-[#52b788]/50 hover:shadow-sm"
                    >
                      <div className="font-medium text-[#1B1F23]">
                        {inv.invoice_number}
                        <span className="ml-2 text-[13px] font-normal text-[#6B7280]">
                          · {formatGermanDate(inv.invoice_date)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[13px] text-[#6B7280]">
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
                    </Link>
                  )
                })}
              </SearchSection>
            )}
          </div>
        </>
      )}
    </main>
  )
}

function SearchSection({
  title,
  icon,
  count,
  children,
}: {
  title: string
  icon: string
  count: number
  children: React.ReactNode
}) {
  if (count === 0) return null
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-[#1B1F23]">
        <i className={`bi ${icon} text-[16px]`} />
        {title} ({count})
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  )
}
