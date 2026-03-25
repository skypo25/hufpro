'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAppProfile } from '@/context/AppProfileContext'
import {
  animalSingularLabel,
  animalsEmptyMessage,
  animalsInCareLine,
  animalsLoadingMessage,
  animalsNavLabel,
  animalsStatLabel,
  newAnimalButtonLabel,
  searchAnimalsPlaceholder,
} from '@/lib/appProfile'

const LIMIT = 20

type HorseItem = {
  id: string
  name: string | null
  breed: string | null
  sex: string | null
  birthYear: number | null
  age: number | null
  usage: string | null
  hoofStatus: string | null
  customerId: string | null
  customerName: string | null
  customerStable: string | null
  nextAppointment: string | null
  documentationCount: number
  intervalWeeks: string | null
}

type Filter = 'all' | 'barhuf' | 'hufschutz' | 'korrektur'
type Sort =
  | 'name_asc'
  | 'name_desc'
  | 'owner_asc'
  | 'next_appointment'
  | 'breed'
  | 'age_asc'
type ViewMode = 'list' | 'cards'

function getBreedSex(h: HorseItem): string {
  const parts = [h.breed, h.sex].filter(Boolean) as string[]
  return parts.length > 0 ? parts.join(' · ') : '–'
}

/** Pferd-Icon wie auf der Desktop-Pferdeseite (SVG) */
function IconHorse() {
  return (
    <svg
      viewBox="0 0 576 512"
      fill="currentColor"
      width={18}
      height={18}
      className="horse-icon-svg"
      aria-hidden
    >
      <path d="M448 238.1l0-78.1 16 0 9.8 19.6c12.5 25.1 42.2 36.4 68.3 26 20.5-8.2 33.9-28 33.9-50.1L576 80c0-19.1-8.4-36.3-21.7-48l5.7 0c8.8 0 16-7.2 16-16S568.8 0 560 0L448 0C377.3 0 320 57.3 320 128l-171.2 0C118.1 128 91.2 144.3 76.3 168.8 33.2 174.5 0 211.4 0 256l0 56c0 13.3 10.7 24 24 24s24-10.7 24-24l0-56c0-13.4 6.6-25.2 16.7-32.5 1.6 13 6.3 25.4 13.6 36.4l28.2 42.4c8.3 12.4 6.4 28.7-1.2 41.6-16.5 28-20.6 62.2-10 93.9l17.5 52.4c4.4 13.1 16.6 21.9 30.4 21.9l33.7 0c21.8 0 37.3-21.4 30.4-42.1l-20.8-62.5c-2.1-6.4-.5-13.4 4.3-18.2l12.7-12.7c13.2-13.2 20.6-31.1 20.6-49.7 0-2.3-.1-4.6-.3-6.9l84 24c4.1 1.2 8.2 2.1 12.3 2.8L320 480c0 17.7 14.3 32 32 32l32 0c17.7 0 32-14.3 32-32l0-164.3c19.2-19.2 31.5-45.7 32-75.7l0 0 0-1.9zM496 64a16 16 0 1 1 0 32 16 16 0 1 1 0-32z" />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={20} height={20}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={12} height={12}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  )
}

function IconDoc() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    </svg>
  )
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={13} height={13}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={13} height={13}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
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
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

export default function MobileHorses() {
  const { profile } = useAppProfile()
  const t = profile.terminology
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('name_asc')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [horses, setHorses] = useState<HorseItem[]>([])
  const [total, setTotal] = useState(0)
  const [horseCount, setHorseCount] = useState(0)
  const [customerCount, setCustomerCount] = useState(0)
  const [barhufCount, setBarhufCount] = useState(0)
  const [hoofschutzCount, setHoofschutzCount] = useState(0)
  const [correctionCount, setCorrectionCount] = useState(0)
  const [avgInterval, setAvgInterval] = useState<string>('–')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [debouncedQ, setDebouncedQ] = useState('')
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
      const res = await fetch(`/api/horses/mobile?${params}`, { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      if (append) {
        setHorses((prev) => [...prev, ...(data.horses ?? [])])
      } else {
        setHorses(data.horses ?? [])
      }
      setTotal(data.total ?? 0)
      setHorseCount(data.horseCount ?? 0)
      setCustomerCount(data.customerCount ?? 0)
      setBarhufCount(data.barhufCount ?? 0)
      setHoofschutzCount(data.hoofschutzCount ?? 0)
      setCorrectionCount(data.correctionCount ?? 0)
      setAvgInterval(data.avgInterval ?? '–')
    },
    [debouncedQ, filter, sort]
  )

  useEffect(() => {
    setLoading(true)
    fetchData(0, false).finally(() => setLoading(false))
  }, [fetchData])

  const loadMore = useCallback(() => {
    if (loadingMore || horses.length >= total) return
    setLoadingMore(true)
    fetchData(horses.length, true).finally(() => setLoadingMore(false))
  }, [loadingMore, horses.length, total, fetchData])

  const hasMore = total > horses.length

  /** Für Listenansicht: nach Anfangsbuchstabe des Pferdenamens gruppieren */
  const horsesByLetter = (() => {
    const map = new Map<string, HorseItem[]>()
    for (const h of horses) {
      const name = (h.name || '').trim()
      const letter = (name.charAt(0) || '?').toUpperCase()
      const key = /[A-ZÄÖÜa-zäöü]/.test(letter) ? letter : '#'
      const list = map.get(key) || []
      list.push(h)
      map.set(key, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) =>
      a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b, 'de')
    )
  })()

  const filterChips: { key: Filter; label: string; count: number; warn?: boolean }[] = [
    { key: 'all', label: 'Alle', count: horseCount },
    { key: 'barhuf', label: 'Barhuf', count: barhufCount },
    { key: 'hufschutz', label: 'Hufschutz', count: hoofschutzCount },
    { key: 'korrektur', label: 'Korrektur', count: correctionCount, warn: true },
  ]

  return (
    <>
      <div className="status-bar" aria-hidden />
      <header className="mobile-header">
        <div className="ah-top">
          <div>
            <h1 className="mobile-greeting">{animalsNavLabel(t)}</h1>
            <div className="mobile-sub">
              {animalsInCareLine(t, horseCount)} · {customerCount} Kunden
            </div>
          </div>
          <Link href="/horses/new" className="ah-btn" aria-label={newAnimalButtonLabel(t)}>
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
            placeholder={searchAnimalsPlaceholder(t)}
            className="mobile-search-input"
            aria-label="Suchen"
          />
        </div>
      </header>

      <div className="mobile-content">
        <div className="horse-stats-row">
          <div className="customer-stat-box">
            <span className="customer-stat-value">{horseCount}</span>
            <span className="customer-stat-label">{animalsStatLabel(t)}</span>
          </div>
          <div className="customer-stat-box">
            <span className="customer-stat-value">{barhufCount}</span>
            <span className="customer-stat-label">Barhuf</span>
          </div>
          <div className="customer-stat-box">
            <span className="customer-stat-value">{hoofschutzCount}</span>
            <span className="customer-stat-label">Hufschutz</span>
          </div>
          <div className="customer-stat-box">
            <span className="customer-stat-value warn">{correctionCount}</span>
            <span className="customer-stat-label">In Korrektur</span>
          </div>
          <div className="customer-stat-box">
            <span className="customer-stat-value">{avgInterval}</span>
            <span className="customer-stat-label">Ø Intervall Wo</span>
          </div>
        </div>

        <div className="horse-filter-bar">
          {filterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className={`horse-f-chip ${filter === chip.key ? 'active' : ''} ${chip.warn && filter === chip.key ? 'warn active' : ''} ${chip.warn && filter !== chip.key ? 'warn' : ''}`}
              onClick={() => setFilter(chip.key)}
            >
              {chip.key === 'all' ? `${chip.label} (${chip.count})` : `${chip.label} (${chip.count})`}
            </button>
          ))}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="horse-f-sort"
            aria-label="Sortierung"
          >
            <option value="name_asc">Name A–Z</option>
            <option value="name_desc">Name Z–A</option>
            <option value="owner_asc">Besitzer A–Z</option>
            <option value="next_appointment">Nächster Termin</option>
            <option value="breed">Rasse</option>
            <option value="age_asc">Alter</option>
          </select>
          <div className="horse-view-toggle">
            <button
              type="button"
              className={`horse-view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              aria-label="Listenansicht"
              aria-pressed={viewMode === 'list'}
            >
              <IconList />
            </button>
            <button
              type="button"
              className={`horse-view-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
              aria-label="Kartenansicht"
              aria-pressed={viewMode === 'cards'}
            >
              <IconGrid />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="horse-list-loading">{animalsLoadingMessage(t)}</div>
        ) : horses.length === 0 ? (
          <div className="horse-list-empty">{animalsEmptyMessage(t)}</div>
        ) : viewMode === 'list' ? (
          <>
            <div className="horse-list-view">
              {horsesByLetter.map(([letter, list]) => (
                <section key={letter} className="customer-list-section">
                  <h2 className="customer-list-letter" aria-hidden>{letter}</h2>
                  <div className="horse-list-group">
                    {list.map((h) => (
                      <Link key={h.id} href={`/horses/${h.id}`} className="horse-list-row">
                        <div className="horse-list-icon" aria-hidden>
                          <IconHorse />
                        </div>
                        <div className="horse-list-body">
                          <div className="horse-list-name">{h.name || '–'}</div>
                          <div className="horse-list-sub">
                            {h.customerName ?? '–'}
                            {h.customerStable ? ` · ${h.customerStable}` : ''}
                          </div>
                        </div>
                        <div className="horse-list-right">
                          <span className="horse-list-date">
                            {h.nextAppointment
                              ? new Intl.DateTimeFormat('de-DE', {
                                  day: '2-digit',
                                  month: '2-digit',
                                }).format(new Date(h.nextAppointment))
                              : '–'}
                          </span>
                          <span className="horse-list-chevron" aria-hidden>
                            <IconChevronRight />
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            {hasMore && (
              <div className="horse-load-more">
                <button
                  type="button"
                  className="horse-load-more-btn"
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
            <div className="horse-card-list">
              {horses.map((h) => (
                <article key={h.id} className="horse-card">
                  <Link
                    href={`/horses/${h.id}`}
                    className="horse-card-clickable"
                    aria-label={`${animalSingularLabel(t)} ${h.name || ''} öffnen`}
                  >
                    <div className="horse-card-top">
                      <div className="horse-card-icon" aria-hidden>
                        <IconHorse />
                      </div>
                      <div className="horse-card-info">
                        <div className="horse-card-name">{h.name || '–'}</div>
                        <div className="horse-card-breed">{getBreedSex(h)}</div>
                      </div>
                      <div className="horse-card-right">
                        <div className="horse-card-age">{h.age != null ? `${h.age} J.` : '–'}</div>
                        <div className="horse-card-age-label">Alter</div>
                      </div>
                    </div>
                    <div className="horse-card-owner">
                      <IconUser />
                      <span className="horse-card-owner-name">{h.customerName ?? '–'}</span>
                      {h.customerStable && <span className="horse-card-stall">· {h.customerStable}</span>}
                    </div>
                    <div className="horse-card-details">
                      <div className="horse-card-detail">
                        <div className={`horse-card-detail-value ${!h.usage ? 'none' : ''}`}>
                          {h.usage || '–'}
                        </div>
                        <div className="horse-card-detail-label">Nutzung</div>
                      </div>
                      <div className="horse-card-detail">
                        <div className="horse-card-detail-value">{h.documentationCount}</div>
                        <div className="horse-card-detail-label">Dokus</div>
                      </div>
                      <div className="horse-card-detail">
                        <div className={`horse-card-detail-value ${!h.intervalWeeks ? 'none' : ''}`}>
                          {h.intervalWeeks || '–'}
                        </div>
                        <div className="horse-card-detail-label">Intervall</div>
                      </div>
                    </div>
                    <div className="horse-card-footer">
                      <div className={h.nextAppointment ? 'horse-card-termin' : 'horse-card-termin none'}>
                        {h.nextAppointment ? (
                          <>
                            <strong>
                              {new Intl.DateTimeFormat('de-DE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              }).format(new Date(h.nextAppointment))}
                            </strong>
                            {' · '}
                            {new Intl.DateTimeFormat('de-DE', {
                              hour: '2-digit',
                              minute: '2-digit',
                            }).format(new Date(h.nextAppointment))}
                          </>
                        ) : (
                          'kein Termin'
                        )}
                      </div>
                      <div className="horse-card-dokus">
                        <IconDoc />
                        {h.documentationCount}
                      </div>
                    </div>
                  </Link>
                  <div className="horse-card-actions">
                    {h.customerId ? (
                      <Link href={`/customers/${h.customerId}`} className="horse-card-act">
                        <IconUser /> Besitzer
                      </Link>
                    ) : (
                      <span className="horse-card-act disabled"><IconUser /> Besitzer</span>
                    )}
                    <Link href={`/horses/${h.id}/records/new`} className="horse-card-act">
                      <IconDoc /> Doku
                    </Link>
                    <Link href={`/appointments/new?horseId=${h.id}`} className="horse-card-act">
                      <IconCalendar /> Termin
                    </Link>
                    <Link href={`/horses/${h.id}`} className="horse-card-act">
                      <IconChevronRight /> Details
                    </Link>
                  </div>
                </article>
              ))}
            </div>
            {hasMore && (
              <div className="horse-load-more">
                <button
                  type="button"
                  className="horse-load-more-btn"
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
