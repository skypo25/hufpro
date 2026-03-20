'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Owner = {
  id: string
  name: string | null
  phone: string | null
}

type Horse = {
  id: string
  name: string | null
  breed: string | null
  sex: string | null
  birthYear: number | null
  age: number | null
  usage: string | null
  housing: string | null
  hoofStatus: string | null
  careInterval: string | null
}

type DokuRow = {
  id: string
  record_date: string | null
  photoCount: number
}

type ViewTab = 'overview' | 'docs'

function formatDate(iso: string | null): string {
  if (!iso) return '–'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '–'
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

function formatDateShort(iso: string | null): string {
  if (!iso) return '–'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '–'
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '–'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '–'
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function IconDoc() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  )
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function IconArrowRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function getHorseIdFromPath(path: string): string {
  const m = path.match(/^\/horses\/([^/?#]+)/)
  return (m?.[1] ?? '').trim()
}

export default function MobileHorseDetail({ horseId: horseIdProp }: { horseId?: string }) {
  const pathname = usePathname()
  const fromPath = pathname ? getHorseIdFromPath(pathname) : ''
  const horseId = (horseIdProp && horseIdProp !== 'undefined' ? horseIdProp : fromPath) || ''

  const menuRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<ViewTab>('overview')
  const [horse, setHorse] = useState<Horse | null>(null)
  const [owner, setOwner] = useState<Owner | null>(null)
  const [lastTreatment, setLastTreatment] = useState<string | null>(null)
  const [nextAppointment, setNextAppointment] = useState<string | null>(null)
  const [dokus, setDokus] = useState<DokuRow[]>([])

  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [menuOpen])

  useEffect(() => {
    const idFromUrl =
      typeof window !== 'undefined' ? getHorseIdFromPath(window.location.pathname) : ''
    const effectiveId = (horseId && UUID_REGEX.test(horseId) ? horseId : idFromUrl) || ''
    if (!effectiveId || !UUID_REGEX.test(effectiveId)) {
      setError('Pferd konnte nicht geladen werden (keine gültige ID).')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    fetch(`/api/horses/${effectiveId}/mobile`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          const msg = typeof data?.error === 'string' ? data.error : 'Unbekannter Fehler'
          throw new Error(msg)
        }
        return data
      })
      .then((data) => {
        setHorse(data.horse || null)
        setOwner(data.owner || null)
        setLastTreatment(data.lastTreatment || null)
        setNextAppointment(data.nextAppointment || null)
        setDokus(Array.isArray(data.dokumentationen) ? data.dokumentationen : [])
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Pferd konnte nicht geladen werden.'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [horseId, pathname])

  const metaLine = horse
    ? [
        horse.breed,
        horse.sex,
        horse.birthYear
          ? `geb. ${horse.birthYear}${horse.age ? ` (${horse.age} J.)` : ''}`
          : null,
        owner?.name,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  if (loading) {
    return (
      <>
        <div className="status-bar" aria-hidden />
        <header className="mobile-header">
          <div className="mobile-greeting">Pferd wird geladen…</div>
        </header>
      </>
    )
  }

  if (error || !horse) {
    return (
      <>
        <div className="status-bar" aria-hidden />
        <header className="mobile-header">
          <div className="mobile-greeting">Pferd</div>
        </header>
        <div className="mobile-content">
          <div className="huf-card p-4 text-[14px] text-red-700">
            {error || 'Pferd nicht gefunden.'}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="status-bar" aria-hidden />
      <header className="mobile-header">
        <div className="cd-hero flex items-center gap-3">
          <div className="cd-info min-w-0 flex-1">
            <div className="cd-name">{horse.name || 'Pferd'}</div>
            <div className="cd-meta flex flex-wrap items-center gap-x-1 gap-y-0.5">
              {metaLine && <span className="whitespace-nowrap">{metaLine}</span>}
            </div>
          </div>
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="cd-edit cd-edit--no-bg flex h-9 w-9 items-center justify-center rounded-lg bg-transparent text-white active:bg-white/10"
              aria-label="Menü"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <i className="bi bi-three-dots-vertical text-[20px]" aria-hidden />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-[#f2f2f3] bg-white py-1 shadow-lg"
                style={{ marginTop: 4 }}
              >
                <Link
                  href={`/horses/${horse.id}/edit`}
                  role="menuitem"
                  className="flex items-center gap-2 px-4 py-2.5 text-[14px] font-medium text-[#1B1F23] hover:bg-[#f7f7f7] active:bg-[#f0f0f0]"
                  onClick={() => setMenuOpen(false)}
                >
                  <i className="bi bi-pencil-square text-[14px] text-[#52b788]" />
                  Pferd bearbeiten
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="cd-action-row flex gap-2">
        <Link href={`/appointments/new?horseId=${horse.id}`} className="cd-action-btn flex flex-1 items-center justify-center gap-1.5">
          <IconCalendar />
          Termin anlegen
        </Link>
        <Link href={`/horses/${horse.id}/records/new`} className="cd-action-btn primary flex flex-1 items-center justify-center gap-1.5">
          <IconDoc />
          Dokumentation
        </Link>
      </div>

      <div className="mobile-content">
        <div className="horse-detail-tabs">
          <button
            type="button"
            className={`horse-detail-tab ${tab === 'overview' ? 'active' : ''}`}
            onClick={() => setTab('overview')}
          >
            Übersicht
          </button>
          <button
            type="button"
            className={`horse-detail-tab ${tab === 'docs' ? 'active' : ''}`}
            onClick={() => setTab('docs')}
          >
            Alle Dokumentationen
          </button>
        </div>

        {tab === 'overview' ? (
          <>
            {owner && (
              <div className="owner-row">
                <div className="owner-avatar">
                  {(owner.name || '?')
                    .split(' ')
                    .map((p) => p[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="owner-info">
                  <div className="owner-name">{owner.name}</div>
                  <div className="owner-sub">Besitzer:in</div>
                </div>
                <div className="owner-actions">
                  {owner.phone ? (
                    <a href={`tel:${owner.phone}`} className="owner-act" aria-label="Anrufen">
                      <IconPhone />
                    </a>
                  ) : null}
                  <Link
                    href={`/customers/${owner.id}`}
                    className="owner-act"
                    aria-label="Kundendetails"
                  >
                    <IconArrowRight />
                  </Link>
                </div>
              </div>
            )}

            <div className="status-card">
              <div className="section-header">
                <h3>Behandlungsstatus</h3>
              </div>
              <div className="status-dates">
                <div className="status-date">
                  <div className="status-date-label">Letzte Bearbeitung</div>
                  <div className="status-date-value">
                    {lastTreatment ? formatDateShort(lastTreatment) : '–'}
                  </div>
                </div>
                <div className="status-date">
                  <div className="status-date-label">Nächster Termin</div>
                  <div
                    className={`status-date-value ${
                      nextAppointment ? '' : 'none'
                    }`}
                  >
                    {nextAppointment ? formatDateShort(nextAppointment) : '–'}
                  </div>
                </div>
              </div>
              <div className="status-notice">
                <strong>Bearbeitungsintervall:</strong>{' '}
                {horse.careInterval || 'nicht hinterlegt'}
                <br />
                {nextAppointment
                  ? `Nächster Termin: ${formatDateTime(nextAppointment)}.`
                  : 'Derzeit ist noch kein nächster Termin geplant.'}
              </div>
            </div>

            <div className="section">
              <div className="section-header">
                <h3>Stammdaten</h3>
                <Link href={`/horses/${horse.id}/edit`}>Bearbeiten</Link>
              </div>
              <div className="section-body">
                <div className="sd-grid">
                  <div className="sd-item">
                    <div className="sd-label">Name</div>
                    <div className="sd-value">{horse.name || '–'}</div>
                  </div>
                  <div className="sd-item">
                    <div className="sd-label">Rasse</div>
                    <div className="sd-value">{horse.breed || '–'}</div>
                  </div>
                  <div className="sd-item">
                    <div className="sd-label">Geschlecht</div>
                    <div className="sd-value">{horse.sex || '–'}</div>
                  </div>
                  <div className="sd-item">
                    <div className="sd-label">Geburtsjahr</div>
                    <div className="sd-value">
                      {horse.birthYear
                        ? `${horse.birthYear}${
                            horse.age ? ` (${horse.age} Jahre)` : ''
                          }`
                        : '–'}
                    </div>
                  </div>
                  <div className="sd-item">
                    <div className="sd-label">Besitzer:in</div>
                    <div className="sd-value">
                      {owner ? owner.name || '–' : '–'}
                    </div>
                  </div>
                  <div className="sd-item">
                    <div className="sd-label">Nutzung</div>
                    <div className={`sd-value ${horse.usage ? '' : 'none'}`}>
                      {horse.usage || '–'}
                    </div>
                  </div>
                  <div className="sd-item">
                    <div className="sd-label">Haltung</div>
                    <div className={`sd-value ${horse.housing ? '' : 'none'}`}>
                      {horse.housing || '–'}
                    </div>
                  </div>
                  <div className="sd-item">
                    <div className="sd-label">Hufstatus / Beschlag</div>
                    <div
                      className={`sd-value ${horse.hoofStatus ? '' : 'none'}`}
                    >
                      {horse.hoofStatus || '–'}
                    </div>
                  </div>
                  <div className="sd-item" style={{ gridColumn: '1 / -1' }}>
                    <div className="sd-label">Bearbeitungsintervall</div>
                    <div
                      className={`sd-value ${
                        horse.careInterval ? '' : 'none'
                      }`}
                    >
                      {horse.careInterval || '–'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="section">
              <div className="section-header">
                <h3>Dokumentationen</h3>
                <button
                  type="button"
                  onClick={() => setTab('docs')}
                  className="text-[13px] font-medium text-[#52b788]"
                >
                  Alle anzeigen →
                </button>
              </div>
              <div className="section-body">
                {dokus.length === 0 ? (
                  <p className="text-[13px] text-[#6B7280]">
                    Noch keine Dokumentationen erfasst.
                  </p>
                ) : (
                  dokus.slice(0, 3).map((row) => (
                    <div key={row.id} className="doku-item">
                      <div className="doku-date">
                        {formatDate(row.record_date)}
                      </div>
                      <div className="doku-photos">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                        {row.photoCount} Foto
                        {row.photoCount === 1 ? '' : 's'}
                      </div>
                      <Link
                        href={`/horses/${horse.id}/records/${row.id}`}
                        className="doku-action"
                        aria-label="Dokumentation öffnen"
                      >
                        <IconDoc />
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="danger-section">
              <h3>Aktionen</h3>
              <Link
                href={`/horses/${horse.id}`}
                className="danger-btn"
                aria-label="Pferd im Desktop löschen"
              >
                <IconTrash />
                Pferd löschen
              </Link>
            </div>
          </>
        ) : (
          <div className="section">
            <div className="section-header">
              <h3>Alle Dokumentationen</h3>
              <span className="text-[12px] text-[#9CA3AF]">
                {dokus.length} Einträge
              </span>
            </div>
            <div className="section-body">
              {dokus.length === 0 ? (
                <p className="text-[13px] text-[#6B7280]">
                  Noch keine Dokumentationen erfasst.
                </p>
              ) : (
                dokus.map((row) => (
                  <div key={row.id} className="doku-item">
                    <div className="doku-date">
                      {formatDate(row.record_date)}
                    </div>
                    <div className="doku-photos">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                      {row.photoCount} Foto
                      {row.photoCount === 1 ? '' : 's'}
                    </div>
                    <Link
                      href={`/horses/${horse.id}/records/${row.id}`}
                      className="doku-action"
                      aria-label="Dokumentation öffnen"
                    >
                      <IconDoc />
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

