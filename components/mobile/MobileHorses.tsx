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
import {
  animalTypeBadgeClassName,
  animalTypeIconColor,
  faIconForAnimalType,
  formatAnimalTypeLabel,
} from '@/lib/animalTypeDisplay'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

const INITIAL_LIMIT = 5
const LOAD_MORE_STEP = 10

type HorseItem = {
  id: string
  name: string | null
  breed: string | null
  sex: string | null
  birthYear: number | null
  age: number | null
  animalType: string | null
  usage: string | null
  hoofStatus: string | null
  customerId: string | null
  customerName: string | null
  customerStable: string | null
  nextAppointment: string | null
  documentationCount: number
  intervalWeeks: string | null
}

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
  const [sort, setSort] = useState<Sort>('name_asc')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [horses, setHorses] = useState<HorseItem[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [horseCount, setHorseCount] = useState(0)
  const [customerCount, setCustomerCount] = useState(0)
  const [barhufCount, setBarhufCount] = useState(0)
  const [hoofschutzCount, setHoofschutzCount] = useState(0)
  const [correctionCount, setCorrectionCount] = useState(0)
  const [avgInterval, setAvgInterval] = useState<string>('–')
  const [dogsCount, setDogsCount] = useState(0)
  const [catsCount, setCatsCount] = useState(0)
  const [typeHorseCount, setTypeHorseCount] = useState(0)
  const [smallAnimalsCount, setSmallAnimalsCount] = useState(0)
  const [otherAnimalsCount, setOtherAnimalsCount] = useState(0)
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
    async (offset: number, append: boolean, limitOverride?: number) => {
      try {
        setLoadError(null)
        const params = new URLSearchParams()
        if (debouncedQ) params.set('q', debouncedQ)
        params.set('sort', sort)
        const limit = limitOverride ?? (offset === 0 ? INITIAL_LIMIT : LOAD_MORE_STEP)
        params.set('limit', String(limit))
        params.set('offset', String(offset))
        const res = await fetch(`/api/horses/mobile?${params}`, { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json().catch(() => null)
        if (!data || typeof data !== 'object') {
          setLoadError('Pferdeliste konnte nicht geladen werden. Bitte erneut versuchen.')
          return
        }
      if (append) {
          setHorses((prev) => [...prev, ...(((data as any).horses ?? []) as HorseItem[])])
      } else {
          setHorses((((data as any).horses ?? []) as HorseItem[]))
      }
        setTotal(((data as any).total ?? 0) as number)
        setHorseCount(((data as any).horseCount ?? 0) as number)
        setCustomerCount(((data as any).customerCount ?? 0) as number)
        setBarhufCount(((data as any).barhufCount ?? 0) as number)
        setHoofschutzCount(((data as any).hoofschutzCount ?? 0) as number)
        setCorrectionCount(((data as any).correctionCount ?? 0) as number)
        setAvgInterval((((data as any).avgInterval ?? '–') as string))
        setDogsCount(((data as any).dogsCount ?? 0) as number)
        setCatsCount(((data as any).catsCount ?? 0) as number)
        setTypeHorseCount(((data as any).typeHorseCount ?? 0) as number)
        setSmallAnimalsCount(((data as any).smallAnimalsCount ?? 0) as number)
        setOtherAnimalsCount(((data as any).otherAnimalsCount ?? 0) as number)
      } catch (e) {
        console.warn('[mobile-horses] fetch failed', e)
        setLoadError('Pferdeliste konnte nicht geladen werden. Bitte erneut versuchen.')
      }
    },
    [debouncedQ, sort]
  )

  useEffect(() => {
    setLoading(true)
    fetchData(0, false, INITIAL_LIMIT).finally(() => setLoading(false))
  }, [fetchData])

  const loadMore = useCallback(() => {
    if (loadingMore || horses.length >= total) return
    setLoadingMore(true)
    fetchData(horses.length, true, LOAD_MORE_STEP).finally(() => setLoadingMore(false))
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

  const isPferdTerm = t === 'pferd'

  return (
    <>
      {loadError && <div className="mhf-error-toast">{loadError}</div>}
      <div className="status-bar" aria-hidden />
      <header className="mobile-header">
        <div className="ah-top">
          <div>
            <h1 className="mobile-greeting">{animalsNavLabel(t)}</h1>
            <div className="mobile-sub">
              {animalsInCareLine(t, horseCount)} · {customerCount} Kunden
            </div>
          </div>
          <Link href="/animals/new" className="ah-btn" aria-label={newAnimalButtonLabel(t)}>
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
        <div className={`horse-stats-row ${isPferdTerm ? 'horse-stats-row--pferd' : 'horse-stats-row--tier'}`}>
          {isPferdTerm ? (
            <>
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
            </>
          ) : (
            <>
              <div className="customer-stat-box">
                <span className="customer-stat-value">{horseCount}</span>
                <span className="customer-stat-label">Tiere gesamt</span>
              </div>
              <div className="customer-stat-box">
                <span className="customer-stat-value">{dogsCount}</span>
                <span className="customer-stat-label">Hunde</span>
              </div>
              <div className="customer-stat-box">
                <span className="customer-stat-value">{catsCount}</span>
                <span className="customer-stat-label">Katzen</span>
              </div>
              <div className="customer-stat-box">
                <span className="customer-stat-value">{typeHorseCount}</span>
                <span className="customer-stat-label">Pferde</span>
              </div>
              <div className="customer-stat-box">
                <span className="customer-stat-value">{smallAnimalsCount}</span>
                <span className="customer-stat-label">Kleintiere</span>
              </div>
              <div className="customer-stat-box">
                <span className="customer-stat-value">{otherAnimalsCount}</span>
                <span className="customer-stat-label">Sonstige</span>
              </div>
            </>
          )}
        </div>

        <div className="horse-filter-bar horse-filter-bar--sort-only">
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
                      <Link key={h.id} href={`/animals/${h.id}`} className="horse-list-row">
                        <div className="horse-list-icon" aria-hidden>
                          <FontAwesomeIcon
                            icon={faIconForAnimalType(h.animalType)}
                            className="h-4 w-4"
                            style={{ color: animalTypeIconColor }}
                          />
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
                    href={`/animals/${h.id}`}
                    className="horse-card-clickable"
                    aria-label={`${animalSingularLabel(t)} ${h.name || ''} öffnen`}
                  >
                    <div className="horse-card-top">
                      <div className="horse-card-icon" aria-hidden>
                        <FontAwesomeIcon
                          icon={faIconForAnimalType(h.animalType)}
                          className="h-4 w-4"
                          style={{ color: animalTypeIconColor }}
                        />
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
                        <div
                          className={`horse-card-detail-value ${
                            t === 'tier' ? 'min-w-0' : !h.usage ? 'none' : ''
                          }`}
                        >
                          {t === 'tier' ? (
                            <span className={`${animalTypeBadgeClassName} truncate`}>
                              {formatAnimalTypeLabel(h.animalType)}
                            </span>
                          ) : (
                            h.usage || '–'
                          )}
                        </div>
                        <div className="horse-card-detail-label">
                          {t === 'tier' ? 'Tierart' : 'Nutzung'}
                        </div>
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
                    <Link href={`/animals/${h.id}/records/new`} className="horse-card-act">
                      <IconDoc /> Doku
                    </Link>
                    <Link href={`/appointments/new?horseId=${h.id}`} className="horse-card-act">
                      <IconCalendar /> Termin
                    </Link>
                    <Link href={`/animals/${h.id}`} className="horse-card-act">
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
