'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import DashboardAnimatedSection from '@/components/dashboard/DashboardAnimatedSection'
import { useAppProfile } from '@/context/AppProfileContext'
import {
  animalsNavLabel,
  dashboardAnimalsBetreutLabel,
  newAnimalButtonLabel,
} from '@/lib/appProfile'
import AppointmentAnimalsInline, {
  CALENDAR_OVERVIEW_ICON_CLASS,
} from '@/components/appointments/AppointmentAnimalsInline'

const BAR_CONTAINER_HEIGHT = 80
const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

function formatEuro(cents: number | null | undefined) {
  const c = Number(cents)
  if (!Number.isFinite(c)) return '0,00 €'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(c / 100)
}

type MobileUmsatzBarsProps = {
  monthlyCents: number[]
  totalCents: number
}

function MobileUmsatzBars({ monthlyCents, totalCents }: MobileUmsatzBarsProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) setVisible(true) },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const maxCents = Math.max(1, ...monthlyCents)
  const currentMonth = new Date().getMonth()

  return (
    <div ref={ref} className="uc-bars">
      {MONTHS.map((month, i) => {
        const cents = monthlyCents[i] ?? 0
        const filled = cents > 0
        const hPercent = maxCents > 0 ? (cents / maxCents) * 100 : 0
        const heightPx = filled ? (hPercent / 100) * BAR_CONTAINER_HEIGHT : 4
        return (
          <div key={i} className="uc-col">
            <div
              className={`uc-bar uc-bar--animated ${filled ? (i === currentMonth ? 'current' : 'filled') : 'empty'}`}
              style={{
                height: visible ? heightPx : (filled ? 0 : 4),
                transitionDelay: `${i * 45}ms`,
              }}
            />
            <div className="uc-month" style={i === currentMonth ? { color: '#52b788', fontWeight: 600 } : undefined}>{month}</div>
          </div>
        )
      })}
    </div>
  )
}

const UMSATZ_LABEL = 'Umsatz (bezahlte & offene Rechnungen)'

type DashboardAnimal = { name: string; animalType: string | null }

type TodayAppointment = {
  id: string
  time: string
  name: string
  animals: DashboardAnimal[]
  notes: string | null
  status: string
  navAddress?: string
}

type UpcomingItem = {
  id: string
  day: string
  month: string
  customerName: string
  animals: DashboardAnimal[]
  time: string
  notes: string | null
  navAddress?: string
}

/** URL für Navigation zur Adresse je nach gewählter App (Standard: Google) */
function getNavUrl(app: 'apple' | 'google' | 'waze', address: string): string {
  const encoded = encodeURIComponent(address.trim())
  if (app === 'apple') {
    return `https://maps.apple.com/?daddr=${encoded}`
  }
  if (app === 'waze') {
    return `https://waze.com/ul?q=${encoded}&navigate=yes`
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`
}
type StatItem = { label: string; value: string; sub: string; subClass: 'green' | 'neutral' | 'red' }

function getGreeting(firstName: string | null): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'Europe/Berlin',
    }).format(new Date())
  )
  if (hour < 12) return 'Guten Morgen'
  if (hour < 18) return 'Guten Tag'
  return 'Guten Abend'
}

const ACTIVITIES = [
  { dot: 'gray' as const, text: 'Neue Termine, Kunden und Tiere erscheinen hier als Nächstes.' },
  { dot: 'green' as const, text: 'Die Box ist vorbereitet und kann später mit echten Aktivitäten befüllt werden.' },
  { dot: 'blue' as const, text: 'Dashboard-Stil wurde an dein Wunschlayout angepasst.' },
]

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={20} height={20}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}
function IconBell() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={20} height={20}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
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
function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={18} height={18}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  )
}
function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={18} height={18}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
    </svg>
  )
}
function IconChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}>
      <polyline points="9 18 15 12 9 6" />
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
function IconDoc() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    </svg>
  )
}
const DEFAULT_STRIP = { termine: 0, pferde: 0, kunden: 0 }
const DEFAULT_STATS: StatItem[] = [
  { label: 'Kunden gesamt', value: '0', sub: 'aktive Kunden', subClass: 'green' },
  { label: 'Pferde betreut', value: '0', sub: 'im System', subClass: 'neutral' },
  { label: 'Termine diese Woche', value: '0', sub: 'geplant', subClass: 'neutral' },
  { label: 'Dokumentationen', value: '0', sub: 'erfasst', subClass: 'red' },
]

const DASH_CACHE_KEY = 'anidocs:mobileDashboard:v1'
const DASH_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000 // 12h

export default function MobileDashboard() {
  const { profile } = useAppProfile()
  const term = profile.terminology

  const [monthlyRevenueCents, setMonthlyRevenueCents] = useState<number[]>(() => Array(12).fill(0))
  const [totalRevenueCents, setTotalRevenueCents] = useState(0)
  const [userFirstName, setUserFirstName] = useState<string | null>(null)
  const [dateLabel, setDateLabel] = useState<string>('')
  const [todayStrip, setTodayStrip] = useState(DEFAULT_STRIP)
  const [stats, setStats] = useState<StatItem[]>(DEFAULT_STATS)
  const [todayAppointments, setTodayAppointments] = useState<TodayAppointment[]>([])
  const [upcomingItems, setUpcomingItems] = useState<UpcomingItem[]>([])
  const [preferredNavApp, setPreferredNavApp] = useState<'apple' | 'google' | 'waze'>('google')

  // Instant-start: hydrate from last known payload (avoids "Du" + zeros while network warms up).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DASH_CACHE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as {
        ts?: number
        userFirstName?: string | null
        dateLabel?: string
        preferredNavApp?: 'apple' | 'google' | 'waze'
        todayStrip?: { termine: number; pferde: number; kunden: number }
        stats?: StatItem[]
        todayAppointments?: TodayAppointment[]
        upcomingAppointments?: UpcomingItem[]
        monthlyCents?: number[]
        totalCents?: number
      }
      const ts = Number(parsed.ts)
      if (!Number.isFinite(ts) || Date.now() - ts > DASH_CACHE_MAX_AGE_MS) return
      setUserFirstName(parsed.userFirstName ?? null)
      setDateLabel(parsed.dateLabel ?? '')
      setPreferredNavApp(parsed.preferredNavApp ?? 'google')
      setTodayStrip(parsed.todayStrip ?? DEFAULT_STRIP)
      setStats(Array.isArray(parsed.stats) ? parsed.stats : DEFAULT_STATS)
      setTodayAppointments(Array.isArray(parsed.todayAppointments) ? parsed.todayAppointments : [])
      setUpcomingItems(Array.isArray(parsed.upcomingAppointments) ? parsed.upcomingAppointments : [])
      if (Array.isArray(parsed.monthlyCents)) setMonthlyRevenueCents(parsed.monthlyCents)
      if (typeof parsed.totalCents === 'number') setTotalRevenueCents(parsed.totalCents)
    } catch {
      // ignore cache
    }
  }, [])

  useEffect(() => {
    const animalsLabel = dashboardAnimalsBetreutLabel(term)
    setStats((prev) => {
      const idx = prev.findIndex((r) => r.sub === 'im System')
      if (idx < 0) return prev
      if (prev[idx].label === animalsLabel) return prev
      const next = [...prev]
      next[idx] = { ...next[idx], label: animalsLabel }
      return next
    })
  }, [term])

  useEffect(() => {
    let cancelled = false
    fetch('/api/dashboard/mobile', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: {
        userFirstName?: string | null
        dateLabel?: string
        preferredNavApp?: 'apple' | 'google' | 'waze'
        todayStrip?: { termine: number; pferde: number; kunden: number }
        stats?: StatItem[]
        todayAppointments?: TodayAppointment[]
        upcomingAppointments?: UpcomingItem[]
      } | null) => {
        if (cancelled || !data) return
        setUserFirstName(data.userFirstName ?? null)
        setDateLabel(data.dateLabel ?? '')
        setPreferredNavApp(data.preferredNavApp ?? 'google')
        setTodayStrip(data.todayStrip ?? DEFAULT_STRIP)
        setStats(Array.isArray(data.stats) ? data.stats : DEFAULT_STATS)
        setTodayAppointments(Array.isArray(data.todayAppointments) ? data.todayAppointments : [])
        setUpcomingItems(Array.isArray(data.upcomingAppointments) ? data.upcomingAppointments : [])

        // Persist partial cache (revenue comes from separate endpoint below).
        try {
          const existingRaw = localStorage.getItem(DASH_CACHE_KEY)
          const existing = existingRaw ? (JSON.parse(existingRaw) as any) : {}
          localStorage.setItem(
            DASH_CACHE_KEY,
            JSON.stringify({
              ...existing,
              ts: Date.now(),
              userFirstName: data.userFirstName ?? null,
              dateLabel: data.dateLabel ?? '',
              preferredNavApp: data.preferredNavApp ?? 'google',
              todayStrip: data.todayStrip ?? DEFAULT_STRIP,
              stats: Array.isArray(data.stats) ? data.stats : DEFAULT_STATS,
              todayAppointments: Array.isArray(data.todayAppointments) ? data.todayAppointments : [],
              upcomingAppointments: Array.isArray(data.upcomingAppointments) ? data.upcomingAppointments : [],
            })
          )
        } catch {
          // ignore
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTodayStrip(DEFAULT_STRIP)
          setStats(DEFAULT_STATS)
          setTodayAppointments([])
          setUpcomingItems([])
        }
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/dashboard/revenue', { credentials: 'include' })
      .then((res) => res.ok ? res.json() : { monthlyCents: Array(12).fill(0), totalCents: 0 })
      .then((data: { monthlyCents?: number[]; totalCents?: number }) => {
        if (cancelled) return
        setMonthlyRevenueCents(Array.isArray(data.monthlyCents) ? data.monthlyCents : Array(12).fill(0))
        setTotalRevenueCents(Number(data.totalCents) || 0)
        try {
          const existingRaw = localStorage.getItem(DASH_CACHE_KEY)
          const existing = existingRaw ? (JSON.parse(existingRaw) as any) : {}
          localStorage.setItem(
            DASH_CACHE_KEY,
            JSON.stringify({
              ...existing,
              ts: Date.now(),
              monthlyCents: Array.isArray(data.monthlyCents) ? data.monthlyCents : Array(12).fill(0),
              totalCents: Number(data.totalCents) || 0,
            })
          )
        } catch {
          // ignore
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMonthlyRevenueCents(Array(12).fill(0))
          setTotalRevenueCents(0)
        }
      })
    return () => { cancelled = true }
  }, [])

  const greeting = getGreeting(userFirstName)
  const displayName = (userFirstName ?? '').trim() || 'Du'
  const displayDateLabel = dateLabel || new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  }).format(new Date())

  return (
    <>
      <div className="status-bar" aria-hidden />
      <header className="mobile-header">
        <div className="ah-top">
          <div>
            <div className="mobile-greeting">{greeting}, {displayName}</div>
            <div className="mobile-sub">{displayDateLabel}</div>
          </div>
          <div className="flex gap-2">
            <Link href="/suche" className="ah-btn" aria-label="Suche">
              <IconSearch />
            </Link>
            <button type="button" className="ah-btn" aria-label="Benachrichtigungen">
              <IconBell />
              <span className="ah-dot" aria-hidden />
            </button>
          </div>
        </div>
        <div className="today-strip">
          <div className="ts-item">
            <div className="ts-value">{todayStrip.termine}</div>
            <div className="ts-label">Termine heute</div>
          </div>
          <div className="ts-divider" />
          <div className="ts-item">
            <div className="ts-value">{todayStrip.pferde}</div>
            <div className="ts-label">{animalsNavLabel(term)}</div>
          </div>
          <div className="ts-divider" />
          <div className="ts-item">
            <div className="ts-value">{todayStrip.kunden}</div>
            <div className="ts-label">Kunden</div>
          </div>
        </div>
      </header>

      <div className="mobile-content">
        <DashboardAnimatedSection delay={0}>
          <div className="quick-actions">
            <Link href="/customers/new" className="qa">
              <div className="qa-icon"><IconUserPlus /></div>
              Kunde anlegen
            </Link>
            <Link href="/animals/new" className="qa">
              <div className="qa-icon"><IconPlus /></div>
              {newAnimalButtonLabel(term)}
            </Link>
            <Link href="/appointments/new" className="qa">
              <div className="qa-icon"><IconCalendar /></div>
              Termin erstellen
            </Link>
          </div>
        </DashboardAnimatedSection>

        <DashboardAnimatedSection delay={50}>
          <div className="stats-grid">
            {stats.map((s) => (
              <div key={s.label} className="stat">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value">{s.value}</div>
                <div className={`stat-sub ${s.subClass}`}>{s.sub}</div>
              </div>
            ))}
          </div>
        </DashboardAnimatedSection>

        <DashboardAnimatedSection delay={100}>
          <div className="section-title">
            <h2>Heutige Termine</h2>
            <Link href="/calendar">Alle Termine <IconChevronRight /></Link>
          </div>
          {todayAppointments.length === 0 ? (
          <p className="text-[14px] text-[#6B7280] py-4">Keine Termine für heute.</p>
        ) : (
          todayAppointments.map((apt) => (
            <div key={apt.id} className="apt-card">
              <div className="apt-inner">
                <div className="apt-time-block">
                  <div className="apt-time">{apt.time}</div>
                  <div className="apt-period">Uhr</div>
                </div>
                <div className="apt-info">
                  <div className="apt-name">{apt.name}</div>
                  <div className="apt-detail">
                    <AppointmentAnimalsInline
                      animals={apt.animals}
                      inheritTextStyle
                      iconClassName={CALENDAR_OVERVIEW_ICON_CLASS}
                    />
                    {apt.notes ? ` · ${apt.notes}` : ''}
                  </div>
                </div>
                <span className="apt-badge ok">{apt.status}</span>
              </div>
              <div className="apt-actions">
                {apt.navAddress ? (
                  <a
                    href={getNavUrl(preferredNavApp, apt.navAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="apt-act"
                  >
                    <IconMap /> Route
                  </a>
                ) : null}
                <Link href={`/appointments/${apt.id}`} className="apt-act"><IconDoc /> Doku</Link>
                <Link href="/calendar" className="apt-act">Kalender</Link>
              </div>
            </div>
          ))
        )}
        </DashboardAnimatedSection>

        <DashboardAnimatedSection delay={0}>
          <div style={{ height: 10 }} />
          <div className="section-title">
            <h2>Umsatz</h2>
            <Link href="/invoices">Details <IconChevronRight /></Link>
          </div>
          <div className="umsatz-card">
            <div className="uc-amount">{formatEuro(totalRevenueCents ?? 0)}</div>
            <div className="uc-label">{UMSATZ_LABEL}</div>
            <MobileUmsatzBars monthlyCents={monthlyRevenueCents} totalCents={totalRevenueCents} />
          </div>
        </DashboardAnimatedSection>

        <DashboardAnimatedSection delay={0}>
          <div className="section-title">
            <h2>Nächste Termine</h2>
            <Link href="/calendar">Kalender <IconChevronRight /></Link>
          </div>
          <div className="next-list">
            {upcomingItems.length === 0 ? (
              <p className="text-[14px] text-[#6B7280] py-4">Keine kommenden Termine.</p>
            ) : (
              upcomingItems.map((item) => (
                <Link key={item.id} href={`/appointments/${item.id}`} className="next-item">
                  <div className="ni-date">
                    <div className="ni-day">{item.day}</div>
                    <div className="ni-month">{item.month}</div>
                  </div>
                  <div className="ni-info">
                    <div className="ni-title flex flex-wrap items-center gap-x-1 gap-y-0.5">
                      <span>{item.customerName}</span>
                      {item.animals.length > 0 ? (
                        <>
                          <span className="text-[#9CA3AF]">·</span>
                          <AppointmentAnimalsInline
                            animals={item.animals}
                            inheritTextStyle
                            iconClassName={CALENDAR_OVERVIEW_ICON_CLASS}
                          />
                        </>
                      ) : null}
                    </div>
                    <div className="ni-sub">
                      {item.time}
                      {item.notes ? ` · ${item.notes}` : ''}
                    </div>
                  </div>
                  <div className="ni-chevron">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><polyline points="9 18 15 12 9 6" /></svg>
                  </div>
                </Link>
              ))
            )}
          </div>
        </DashboardAnimatedSection>

        <DashboardAnimatedSection delay={0}>
          <div className="activity-card">
            <h3>Letzte Aktivitäten</h3>
            {ACTIVITIES.map((a, i) => (
              <div key={i} className="act-item">
                <div className={`act-dot ${a.dot}`} />
                <div className="act-text">{a.text}</div>
              </div>
            ))}
          </div>
        </DashboardAnimatedSection>
      </div>
    </>
  )
}
