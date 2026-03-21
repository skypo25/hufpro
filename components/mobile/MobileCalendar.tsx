'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHorse } from '@fortawesome/free-solid-svg-icons'

type DayInfo = {
  dateKey: string
  dayName: string
  dayNum: number
  isToday: boolean
  dotColors: string[]
}

type AppointmentCard = {
  id: string
  customerName: string
  horseLabel: string
  stallLabel: string
  time: string
  endTime: string
  type: string
  status: string
  color: 'green' | 'orange' | 'blue' | 'purple' | 'gray'
  badge: 'confirmed' | 'suggested'
  isPast?: boolean
}

type ApiResponse = {
  weekStart: string
  weekLabel: string
  weekNumber: number
  days: DayInfo[]
  appointmentsByDay: Record<string, AppointmentCard[]>
  filterCounts: { all: number; confirmed: number; suggested: number }
}

const WEEKDAY_LABELS: Record<string, string> = {
  mo: 'Mo',
  di: 'Di',
  mi: 'Mi',
  do: 'Do',
  fr: 'Fr',
  sa: 'Sa',
  so: 'So',
}

function formatDayHeader(dateKey: string, isToday: boolean) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dayName = new Intl.DateTimeFormat('de-DE', { weekday: 'short' }).format(date)
  const dateStr = new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
  }).format(date)
  if (isToday) return `${dayName}, ${dateStr} · Heute`
  return `${dayName}, ${dateStr}`
}

function IconChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={18} height={18}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function IconChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={18} height={18}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}


function IconLocation() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={12} height={12}>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
    </svg>
  )
}

function IconCalendarX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={36} height={36}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="10" y1="15" x2="14" y2="15" />
    </svg>
  )
}

function IconCalendarCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={36} height={36}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M9 16l2 2 4-4" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={22} height={22}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

type AppointmentDetail = {
  appointment: { id: string; timeRange: string; dateLong: string | null; type: string | null; status: string | null }
  customer: {
    name: string
    phone: string | null
    stableDisplay: string
    stableAddress: string
    stableAddressForNav: string
    customerAddressForNav?: string | null
    stableAddressForNavOnly?: string | null
  }
  horses: Array<{ id: string; name: string | null }>
  preferredNavApp?: 'apple' | 'google' | 'waze'
}

function getNavUrl(app: 'apple' | 'google' | 'waze', address: string): string {
  const encoded = encodeURIComponent(address.trim())
  if (app === 'apple') return `https://maps.apple.com/?daddr=${encoded}`
  if (app === 'waze') return `https://waze.com/ul?q=${encoded}&navigate=yes`
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`
}

export default function MobileCalendar() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'suggested'>('all')
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<AppointmentDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [routeSegmentOpen, setRouteSegmentOpen] = useState(false)

  const fetchWeek = useCallback(async (ws: string | null) => {
    setLoading(true)
    const params = ws ? `?weekStart=${ws}` : ''
    try {
      const res = await fetch(`/api/calendar/mobile${params}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!res.ok) return
      const json = await res.json()
      setData(json)
      const today = json.days?.find((d: DayInfo) => d.isToday)
      setSelectedDay(today ? today.dateKey : json.days?.[0]?.dateKey ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWeek(null)
  }, [fetchWeek])

  useEffect(() => {
    if (!selectedAppointmentId) {
      setDetailData(null)
      setRouteSegmentOpen(false)
      return
    }
    setDetailLoading(true)
    setDetailData(null)
    fetch(`/api/appointments/${selectedAppointmentId}/mobile`, { credentials: 'include' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error || 'Fehler beim Laden')
        return json
      })
      .then(setDetailData)
      .catch(() => setDetailData(null))
      .finally(() => setDetailLoading(false))
  }, [selectedAppointmentId])

  useEffect(() => {
    if (!selectedAppointmentId) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [selectedAppointmentId])

  function toDateString(d: Date) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  function goPrevWeek() {
    if (!data?.weekStart) return
    const [y, m, day] = data.weekStart.split('-').map(Number)
    const d = new Date(y, m - 1, day)
    d.setDate(d.getDate() - 7)
    fetchWeek(toDateString(d))
  }

  function goNextWeek() {
    if (!data?.weekStart) return
    const [y, m, day] = data.weekStart.split('-').map(Number)
    const d = new Date(y, m - 1, day)
    d.setDate(d.getDate() + 7)
    fetchWeek(toDateString(d))
  }

  function goToday() {
    const today = data?.days?.find((d) => d.isToday)
    if (today) {
      setSelectedDay(today.dateKey)
    } else {
      fetchWeek(null)
    }
  }

  function filterAppointments(apts: AppointmentCard[]) {
    if (filter === 'all') return apts
    if (filter === 'confirmed') return apts.filter((a) => a.badge === 'confirmed')
    if (filter === 'suggested') return apts.filter((a) => a.badge === 'suggested')
    return apts
  }

  const currentDayApts = selectedDay
    ? filterAppointments(data?.appointmentsByDay?.[selectedDay] ?? [])
    : []
  const currentDayInfo = data?.days?.find((d) => d.dateKey === selectedDay)
  const isTodaySelected = currentDayInfo?.isToday ?? false

  return (
    <div className="cal-page">
      <div className="status-bar" aria-hidden />
      <header className="mobile-header">
        <div className="ah-top">
          <div>
            <h1 className="mobile-greeting">Termine</h1>
            <div className="mobile-sub">
              {data ? `KW ${data.weekNumber} · ${data.weekLabel}` : 'Laden…'}
            </div>
          </div>
          <Link href="/appointments/new" className="ah-btn" aria-label="Neuer Termin">
            <IconPlus />
          </Link>
        </div>
      </header>

      {/* Week Nav */}
      <div className="cal-week-nav">
        <button
          type="button"
          className="cal-wn-arrow"
          onClick={goPrevWeek}
          aria-label="Vorherige Woche"
        >
          <IconChevronLeft />
        </button>
        <div className="cal-wn-label">{data?.weekLabel ?? '–'}</div>
        <button
          type="button"
          className="cal-wn-arrow"
          onClick={goNextWeek}
          aria-label="Nächste Woche"
        >
          <IconChevronRight />
        </button>
        <button type="button" className="cal-wn-today" onClick={goToday}>
          Heute
        </button>
      </div>

      {/* Day Selector */}
      <div className="cal-day-selector">
        {data?.days?.map((day) => (
          <button
            key={day.dateKey}
            type="button"
            className={`cal-day-item ${day.isToday ? 'today' : ''} ${selectedDay === day.dateKey ? 'selected' : ''}`}
            onClick={() => setSelectedDay(day.dateKey)}
            data-day={day.dayName}
          >
            <span className="cal-di-name">{WEEKDAY_LABELS[day.dayName] ?? day.dayName}</span>
            <span className="cal-di-num">{day.dayNum}</span>
            <div className="cal-di-dots">
              {day.dotColors.map((color, i) => (
                <span
                  key={i}
                  className="cal-di-dot"
                    style={{
                      background:
                        color === 'green'
                          ? 'var(--cal-accent)'
                          : color === 'orange'
                            ? '#F97316'
                            : color === 'blue'
                              ? '#2563EB'
                              : color === 'purple'
                                ? '#7C3AED'
                                : color === 'gray'
                                  ? 'var(--m-border, #E5E2DC)'
                                  : 'rgba(255,255,255,.2)',
                    }}
                />
              ))}
            </div>
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="cal-filter-bar">
        <button
          type="button"
          className={`cal-f-chip ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Alle ({data?.filterCounts?.all ?? 0})
        </button>
        <button
          type="button"
          className={`cal-f-chip ${filter === 'confirmed' ? 'active' : ''}`}
          onClick={() => setFilter('confirmed')}
        >
          Bestätigt ({data?.filterCounts?.confirmed ?? 0})
        </button>
        <button
          type="button"
          className={`cal-f-chip ${filter === 'suggested' ? 'active' : ''}`}
          onClick={() => setFilter('suggested')}
        >
          Vorgeschlagen ({data?.filterCounts?.suggested ?? 0})
        </button>
      </div>

      <div className="mobile-content cal-content">
        {loading ? (
          <div className="py-12 text-center text-[14px] text-[#6B7280]">Termine werden geladen…</div>
        ) : !selectedDay ? (
          <div className="cal-empty-day">
            <IconCalendarX />
            <div className="cal-ed-title">Keine Woche geladen</div>
            <div className="cal-ed-sub">Bitte erneut versuchen</div>
          </div>
        ) : currentDayApts.length === 0 ? (
          <div className="cal-empty-day">
            {isTodaySelected ? (
              <>
                <IconCalendarCheck />
                <div className="cal-ed-title">Alles erledigt</div>
                <div className="cal-ed-sub">Heute stehen keine Termine an</div>
              </>
            ) : (
              <>
                <IconCalendarX />
                <div className="cal-ed-title">Freier Tag</div>
                <div className="cal-ed-sub">Keine Termine geplant</div>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="cal-day-header">
              <span>{formatDayHeader(selectedDay, isTodaySelected)}</span>
              <span className="cal-dh-count">
                {currentDayApts.length} {currentDayApts.length === 1 ? 'Termin' : 'Termine'}
              </span>
            </div>
            <div className="cal-timeline">
              <div className="cal-tl-line" />
              {currentDayApts.map((apt) => {
                const isPast = apt.isPast ?? apt.color === 'gray'
                const cardContent = (
                  <>
                    <div className="cal-tl-dot" />
                    <div className="cal-apt-body">
                      <div className="cal-apt-time">
                        {apt.time} – {apt.endTime}
                      </div>
                      <div className="cal-apt-type">{apt.type}</div>
                      <div className="cal-apt-name">{apt.customerName}</div>
                      <div className="cal-apt-detail">
                        <FontAwesomeIcon icon={faHorse} className="cal-apt-horse-icon" />
                        {apt.horseLabel}
                      </div>
                      {apt.stallLabel && (
                        <div className="cal-apt-stall">
                          <IconLocation />
                          {apt.stallLabel}
                        </div>
                      )}
                    </div>
                    <span className={`cal-apt-badge ${apt.badge}`}>
                      {apt.badge === 'confirmed' ? 'Bestätigt' : 'Vorgeschlagen'}
                    </span>
                  </>
                )
                return isPast ? (
                  <Link
                    key={apt.id}
                    href={`/appointments/${apt.id}`}
                    className={`cal-apt-card ${apt.color}`}
                  >
                    {cardContent}
                  </Link>
                ) : (
                  <button
                    key={apt.id}
                    type="button"
                    className={`cal-apt-card ${apt.color}`}
                    onClick={() => setSelectedAppointmentId(apt.id)}
                  >
                    {cardContent}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Bottom-Sheet-Modal: Termin-Details */}
      {selectedAppointmentId && (
        <>
          <div
            role="presentation"
            aria-hidden="true"
            className="cal-sheet-overlay"
            onClick={() => setSelectedAppointmentId(null)}
          />
          <div
            className="cal-sheet"
            aria-modal="true"
            aria-labelledby="cal-sheet-title"
            role="dialog"
          >
            <div className="cal-sheet-handle" aria-hidden />
            <div className="cal-sheet-inner">
              {detailLoading ? (
                <div className="cal-dp-loading">Termin wird geladen…</div>
              ) : detailData ? (
                <div className="cal-dp-body">
                  <div className="cal-dp-header" id="cal-sheet-title">
                    <div className="cal-dp-header-top">
                      <div className="cal-dp-time">
                        <i className="bi bi-clock-fill" />
                        {detailData.appointment.timeRange}
                      </div>
                      <span className={`cal-dp-badge ${detailData.appointment.status?.toLowerCase().includes('bestätigt') ? 'confirmed' : 'suggested'}`}>
                        {detailData.appointment.status || 'Bestätigt'}
                      </span>
                    </div>
                    <div className="cal-dp-date">{detailData.appointment.dateLong}</div>
                  </div>
                  <div className="cal-dp-section">
                    <div className="cal-dp-label">Kunde</div>
                    <div className="cal-dp-value">{detailData.customer.name}</div>
                  </div>
                  <div className="cal-dp-section">
                    <div className="cal-dp-label">Pferde</div>
                    <div className="cal-dp-value">
                      {detailData.horses.map((h) => h.name || 'Pferd').join(', ') || '–'}
                    </div>
                  </div>
                  <div className="cal-dp-section">
                    <div className="cal-dp-label">Stall / Ort</div>
                    <div className="cal-dp-value">{detailData.customer.stableAddress || detailData.customer.stableDisplay || '–'}</div>
                  </div>
                  {detailData.appointment.type && (
                    <div className="cal-dp-section">
                      <div className="cal-dp-label">Art</div>
                      <div className="cal-dp-value">{detailData.appointment.type}</div>
                    </div>
                  )}
                  <div className="cal-dp-actions-wrap">
                    <div className="cal-dp-actions">
                      {detailData.horses[0] && (
                        <Link
                          href={`/horses/${detailData.horses[0].id}/records/new?appointmentId=${selectedAppointmentId}`}
                          className="cal-dp-btn primary"
                        >
                          <i className="bi bi-file-earmark-plus-fill" />
                          Doku
                        </Link>
                      )}
                      {(detailData.customer.stableAddressForNav || detailData.customer.customerAddressForNav) && (
                        (() => {
                          const hasBoth = !!(detailData.customer.customerAddressForNav?.trim() && detailData.customer.stableAddressForNavOnly?.trim())
                          const preferredNavApp = detailData.preferredNavApp ?? 'google'
                          const customerUrl = detailData.customer.customerAddressForNav
                            ? getNavUrl(preferredNavApp, detailData.customer.customerAddressForNav)
                            : null
                          const stableUrl = detailData.customer.stableAddressForNavOnly
                            ? getNavUrl(preferredNavApp, detailData.customer.stableAddressForNavOnly)
                            : detailData.customer.stableAddressForNav
                              ? getNavUrl(preferredNavApp, detailData.customer.stableAddressForNav)
                              : null
                          const directUrl = !hasBoth && (stableUrl || customerUrl)
                          return hasBoth ? (
                            <button
                              type="button"
                              className="cal-dp-btn"
                              onClick={() => setRouteSegmentOpen((o) => !o)}
                            >
                              <i className="bi bi-geo-alt-fill" />
                              Route
                            </button>
                          ) : directUrl ? (
                            <a href={directUrl} target="_blank" rel="noopener noreferrer" className="cal-dp-btn">
                              <i className="bi bi-geo-alt-fill" />
                              Route
                            </a>
                          ) : null
                        })()
                      )}
                      {detailData.customer.phone && (
                        <a href={`tel:${detailData.customer.phone.replace(/\s/g, '')}`} className="cal-dp-btn">
                          <i className="bi bi-telephone-fill" />
                          Anrufen
                        </a>
                      )}
                    </div>
                    {(() => {
                      const hasBoth = !!(detailData.customer.customerAddressForNav?.trim() && detailData.customer.stableAddressForNavOnly?.trim())
                      const preferredNavApp = detailData.preferredNavApp ?? 'google'
                      const customerUrl = detailData.customer.customerAddressForNav
                        ? getNavUrl(preferredNavApp, detailData.customer.customerAddressForNav)
                        : null
                      const stableUrl = detailData.customer.stableAddressForNavOnly
                        ? getNavUrl(preferredNavApp, detailData.customer.stableAddressForNavOnly)
                        : detailData.customer.stableAddressForNav
                          ? getNavUrl(preferredNavApp, detailData.customer.stableAddressForNav)
                          : null
                      return hasBoth && routeSegmentOpen ? (
                        <div className="cd-route-segment cal-dp-route-segment">
                          {customerUrl && (
                            <a href={customerUrl} target="_blank" rel="noopener noreferrer" className="cd-route-segment-btn" onClick={() => setRouteSegmentOpen(false)}>
                              Kundenadresse
                            </a>
                          )}
                          {stableUrl && (
                            <a href={stableUrl} target="_blank" rel="noopener noreferrer" className="cd-route-segment-btn" onClick={() => setRouteSegmentOpen(false)}>
                              Stalladresse
                            </a>
                          )}
                        </div>
                      ) : null
                    })()}
                  </div>
                  <Link href={`/appointments/${selectedAppointmentId}`} className="cal-dp-link">
                    Alle Details anzeigen
                    <i className="bi bi-chevron-right" />
                  </Link>
                </div>
              ) : (
                <div className="cal-dp-loading">Termin konnte nicht geladen werden.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
