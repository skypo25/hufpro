'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

const LIMIT = 20

type CustomerItem = {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  city: string | null
  stable_name: string | null
  stable_city: string | null
  horseCount: number
  horseNames: string[]
  nextAppointment: string | null
  navAddress: string
}

type Filter = 'all' | 'with_appointment' | 'without_appointment' | 'new'
type Sort = 'name_asc' | 'name_desc' | 'next_appointment' | 'horses_desc' | 'newest'
type ViewMode = 'list' | 'cards'

function getNavUrl(app: 'apple' | 'google' | 'waze', address: string): string {
  const encoded = encodeURIComponent(address.trim())
  if (app === 'apple') return `https://maps.apple.com/?daddr=${encoded}`
  if (app === 'waze') return `https://waze.com/ul?q=${encoded}&navigate=yes`
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`
}

function getInitials(name: string | null): string {
  if (!name || !name.trim()) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase().slice(0, 2)
  }
  return name.slice(0, 2).toUpperCase()
}

function formatNextAppointment(iso: string | null): string {
  if (!iso) return '–'
  const d = new Date(iso)
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' }).format(d)
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={20} height={20}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function IconUserPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={18} height={18}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  )
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function IconMap() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  )
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={12} height={12}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function IconList() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={18} height={18}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

function IconGrid() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={18} height={18}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
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

export default function MobileCustomers() {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('name_asc')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [customers, setCustomers] = useState<CustomerItem[]>([])
  const [total, setTotal] = useState(0)
  const [customerCount, setCustomerCount] = useState(0)
  const [horseCount, setHorseCount] = useState(0)
  const [appointmentsThisWeek, setAppointmentsThisWeek] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [preferredNavApp, setPreferredNavApp] = useState<'apple' | 'google' | 'waze'>('google')
  const [debouncedQ, setDebouncedQ] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQ(q), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [q])

  const fetchData = useCallback(
    async (offset: number, append: boolean) => {
      const params = new URLSearchParams()
      if (debouncedQ) params.set('q', debouncedQ)
      params.set('filter', filter)
      params.set('sort', sort)
      params.set('limit', String(LIMIT))
      params.set('offset', String(offset))
      const res = await fetch(`/api/customers/mobile?${params}`, { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      if (append) {
        setCustomers((prev) => [...prev, ...(data.customers ?? [])])
      } else {
        setCustomers(data.customers ?? [])
      }
      setTotal(data.total ?? 0)
      setCustomerCount(data.customerCount ?? 0)
      setHorseCount(data.horseCount ?? 0)
      setAppointmentsThisWeek(data.appointmentsThisWeek ?? 0)
    },
    [debouncedQ, filter, sort]
  )

  useEffect(() => {
    setLoading(true)
    fetchData(0, false).finally(() => setLoading(false))
  }, [fetchData])

  const loadMore = useCallback(() => {
    if (loadingMore || customers.length >= total) return
    setLoadingMore(true)
    fetchData(customers.length, true).finally(() => setLoadingMore(false))
  }, [loadingMore, customers.length, total, fetchData])

  useEffect(() => {
    let cancelled = false
    fetch('/api/dashboard/mobile', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { preferredNavApp?: 'apple' | 'google' | 'waze' } | null) => {
        if (!cancelled && data?.preferredNavApp) setPreferredNavApp(data.preferredNavApp)
      })
    return () => { cancelled = true }
  }, [])

  const hasMore = total > customers.length
  const locationText = (c: CustomerItem) => {
    const parts = [c.stable_city || c.city, c.stable_name].filter(Boolean) as string[]
    return parts.join(' · ') || '–'
  }

  /** Für Listenansicht: nach Anfangsbuchstabe gruppieren (letztes Wort = Nachname) */
  const customersByLetter = (() => {
    const map = new Map<string, CustomerItem[]>()
    for (const c of customers) {
      const name = (c.name || '').trim()
      const lastWord = name.split(/\s+/).filter(Boolean).pop() || name
      const letter = (lastWord.charAt(0) || '?').toUpperCase()
      const key = /[A-ZÄÖÜa-zäöü]/.test(letter) ? letter : '#'
      const list = map.get(key) || []
      list.push(c)
      map.set(key, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b, 'de')))
  })()

  const filterChips: { key: Filter; label: string; count?: number }[] = [
    { key: 'all', label: 'Alle', count: customerCount },
    { key: 'with_appointment', label: 'Mit Termin' },
    { key: 'without_appointment', label: 'Ohne Termin' },
    { key: 'new', label: 'Neu' },
  ]

  return (
    <>
      <div className="status-bar" aria-hidden />
      <header className="mobile-header">
        <div className="ah-top">
          <div>
            <h1 className="mobile-greeting">Kunden</h1>
            <div className="mobile-sub">
              {customerCount} Kunden · {horseCount} Pferde in Betreuung
            </div>
          </div>
          <div className="flex">
            <Link href="/customers/new" className="ah-btn" aria-label="Kunde anlegen">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={20} height={20}>
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </Link>
          </div>
        </div>
        <div className="mobile-search-wrap">
          <IconSearch />
          <input
            ref={searchInputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Kunde, Ort oder Pferd suchen…"
            className="mobile-search-input"
            aria-label="Suchen"
          />
        </div>
      </header>

      <div className="mobile-content">
        <div className="customer-stats-row">
          <div className="customer-stat-box">
            <span className="customer-stat-value">{customerCount}</span>
            <span className="customer-stat-label">KUNDEN</span>
          </div>
          <div className="customer-stat-box">
            <span className="customer-stat-value">{horseCount}</span>
            <span className="customer-stat-label">PFERDE</span>
          </div>
          <div className="customer-stat-box">
            <span className="customer-stat-value">{appointmentsThisWeek}</span>
            <span className="customer-stat-label">TERMINE / WO</span>
          </div>
        </div>

        <div className="customer-filters" role="tablist">
          {filterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              role="tab"
              aria-selected={filter === chip.key}
              className={`customer-filter-chip ${filter === chip.key ? 'active' : ''}`}
              onClick={() => setFilter(chip.key)}
            >
              {chip.key === 'all' && chip.count != null ? `${chip.label} (${chip.count})` : chip.label}
            </button>
          ))}
          <div className="customer-sort-wrap">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="customer-sort-select"
              aria-label="Sortierung"
            >
              <option value="name_asc">Name A–Z</option>
              <option value="name_desc">Name Z–A</option>
              <option value="next_appointment">Nächster Termin</option>
              <option value="horses_desc">Meiste Pferde</option>
              <option value="newest">Neueste zuerst</option>
            </select>
          </div>
          <div className="customer-view-toggle">
            <button
              type="button"
              className={`customer-view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="Listenansicht"
              aria-label="Listenansicht"
              aria-pressed={viewMode === 'list'}
            >
              <IconList />
            </button>
            <button
              type="button"
              className={`customer-view-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
              title="Kartenansicht"
              aria-label="Kartenansicht"
              aria-pressed={viewMode === 'cards'}
            >
              <IconGrid />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="customer-list-loading">Kunden werden geladen…</div>
        ) : customers.length === 0 ? (
          <div className="customer-list-empty">Keine Kunden gefunden.</div>
        ) : viewMode === 'list' ? (
          <>
            <div className="customer-list-view">
              {customersByLetter.map(([letter, list]) => (
                <section key={letter} className="customer-list-section">
                  <h2 className="customer-list-letter" aria-hidden>{letter}</h2>
                  <div className="customer-list-group">
                    {list.map((c) => (
                      <Link key={c.id} href={`/customers/${c.id}`} className="customer-list-row">
                        <div className="customer-list-avatar" aria-hidden>
                          {getInitials(c.name)}
                        </div>
                        <div className="customer-list-body">
                          <div className="customer-list-name">{c.name || 'Unbenannt'}</div>
                          <div className="customer-list-sub">
                            {locationText(c)}
                            {c.horseNames.length > 0 && ` · ${c.horseNames.join(', ')}`}
                          </div>
                        </div>
                        <div className="customer-list-right-block">
                          <span className="customer-list-pill">{c.horseCount}</span>
                          <span className="customer-list-date">{formatNextAppointment(c.nextAppointment)}</span>
                        </div>
                        <span className="customer-list-chevron" aria-hidden>
                          <IconChevronRight />
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            {hasMore && (
              <div className="customer-load-more">
                <button
                  type="button"
                  className="customer-load-more-btn"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Laden…' : 'Mehr laden'}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="customer-card-list">
              {customers.map((c) => (
                <article key={c.id} className="customer-card relative">
                  <Link
                    href={`/customers/${c.id}`}
                    className="absolute inset-0 z-0"
                    aria-label={`Kunde ${c.name || ''} öffnen`}
                  />
                  {/* Wie Desktop: Header mit Avatar, Name, Ort, Pferde-Badge */}
                  <div className="customer-card-header pointer-events-none">
                    <div className="customer-card-avatar" aria-hidden>
                      {getInitials(c.name)}
                    </div>
                    <div className="customer-card-header-main">
                      <div className="customer-card-name">{c.name || 'Unbenannt'}</div>
                      <div className="customer-card-location">
                        <IconPin />
                        <span>{locationText(c)}</span>
                      </div>
                    </div>
                    <div className="customer-card-horses">
                      {c.horseCount} {c.horseCount === 1 ? 'Pferd' : 'Pferde'}
                    </div>
                  </div>
                  {/* Wie Desktop: Nächster Termin, Telefon, E-Mail – ohne Trennlinien dazwischen */}
                  <div className="customer-card-details pointer-events-none">
                    <div className="customer-card-detail-row-inner">
                      <span className="customer-card-contact-label">Nächster Termin</span>
                      <span className="customer-card-contact-value">{formatNextAppointment(c.nextAppointment)}</span>
                    </div>
                    <div className="customer-card-detail-row-inner">
                      <span className="customer-card-contact-label">Telefon</span>
                      {c.phone ? (
                        <a href={`tel:${c.phone}`} className="customer-card-contact-value customer-card-contact-link pointer-events-auto">
                          {c.phone}
                        </a>
                      ) : (
                        <span className="customer-card-contact-value">–</span>
                      )}
                    </div>
                    <div className="customer-card-detail-row-inner">
                      <span className="customer-card-contact-label">E-Mail</span>
                      <span className="customer-card-contact-value">{c.email || '–'}</span>
                    </div>
                  </div>
                  {/* Wie Desktop: Pferdenamen + Details → mit hellem Hintergrund */}
                  <div className="customer-card-footer pointer-events-none">
                    <span className="customer-card-horsenames">
                      {c.horseNames.length > 0 ? c.horseNames.join(' · ') : 'Keine Pferde'}
                    </span>
                    <Link href={`/customers/${c.id}`} className="customer-card-detail-link pointer-events-auto">
                      Details →
                    </Link>
                  </div>
                  {/* Nur Mobile: Buttons darunter */}
                  <div className="customer-card-actions relative z-10 pointer-events-auto">
                    {c.phone ? (
                      <a href={`tel:${c.phone}`} className="customer-card-act">
                        <span className="customer-card-act-icon"><IconPhone /></span>
                        <span className="customer-card-act-label">Anrufen</span>
                      </a>
                    ) : (
                      <span className="customer-card-act disabled">
                        <span className="customer-card-act-icon"><IconPhone /></span>
                        <span className="customer-card-act-label">Anrufen</span>
                      </span>
                    )}
                    {c.navAddress ? (
                      <a
                        href={getNavUrl(preferredNavApp, c.navAddress)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="customer-card-act"
                      >
                        <span className="customer-card-act-icon"><IconMap /></span>
                        <span className="customer-card-act-label">Route</span>
                      </a>
                    ) : (
                      <span className="customer-card-act disabled">
                        <span className="customer-card-act-icon"><IconMap /></span>
                        <span className="customer-card-act-label">Route</span>
                      </span>
                    )}
                    {c.email ? (
                      <a href={`mailto:${c.email}`} className="customer-card-act">
                        <span className="customer-card-act-icon"><IconMail /></span>
                        <span className="customer-card-act-label">E-Mail</span>
                      </a>
                    ) : (
                      <span className="customer-card-act disabled">
                        <span className="customer-card-act-icon"><IconMail /></span>
                        <span className="customer-card-act-label">E-Mail</span>
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {hasMore && (
              <div className="customer-load-more">
                <button
                  type="button"
                  className="customer-load-more-btn"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Laden…' : 'Mehr laden'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
