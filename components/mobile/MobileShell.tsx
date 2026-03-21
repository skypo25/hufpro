'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import MobileFab from './MobileFab'
import MobileMoreSheet from './MobileMoreSheet'
import {
  faTableCellsLarge,
  faCalendarDays,
  faHorse,
  faUsers,
  faGear,
} from '@fortawesome/free-solid-svg-icons'

const NAV_LINK_ITEMS: { href: string; label: string; icon: typeof faTableCellsLarge }[] = [
  { href: '/dashboard', label: 'Start', icon: faTableCellsLarge },
  { href: '/calendar', label: 'Termine', icon: faCalendarDays },
  { href: '/horses', label: 'Pferde', icon: faHorse },
  { href: '/customers', label: 'Kunden', icon: faUsers },
]

export default function MobileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [moreSheetOpen, setMoreSheetOpen] = useState(false)
  const [todayAppointmentCount, setTodayAppointmentCount] = useState(0)
  const showTabBar = !/\/(records\/(new|[^/]+\/edit)|customers\/(new|[^/]+\/edit)|horses\/new)$/.test(pathname ?? '')
  const isMoreActive = pathname?.startsWith('/settings') ?? false

  useEffect(() => {
    fetch('/api/appointments/today-count', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data?.count != null) setTodayAppointmentCount(data.count) })
      .catch(() => {})
  }, [pathname])

  return (
    <div className="mobile-app flex min-h-screen flex-col md:hidden">
      {/* Hauptinhalt – Header kommt von der jeweiligen Seite */}
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>

      {/* FAB nur auf Nicht-Formular-Seiten zeigen */}
      {showTabBar && <MobileFab />}

      {/* More-Sheet (Overlay + Menü) */}
      <MobileMoreSheet open={moreSheetOpen} onClose={() => setMoreSheetOpen(false)} />

      {/* Tab-Bar */}
      {showTabBar && (
        <nav className="mobile-tab-bar mobile-tab-bar-z" aria-label="Hauptnavigation">
          {NAV_LINK_ITEMS.map(({ href, label, icon }) => {
            const isActive =
              href === '/dashboard'
                ? pathname === '/dashboard'
                : href === '/calendar'
                  ? pathname?.startsWith('/calendar') || pathname?.startsWith('/appointments')
                  : pathname?.startsWith(href)
            const badge = href === '/calendar' ? todayAppointmentCount : undefined
            return (
              <Link
                key={href}
                href={href}
                className={`mobile-tab ${isActive ? 'active' : ''}`}
              >
                <span className="relative inline-block">
                  <FontAwesomeIcon icon={icon} className="text-[22px]" />
                  {badge != null && badge > 0 && (
                    <span className="tab-badge">{badge > 99 ? '99+' : badge}</span>
                  )}
                </span>
                <span className="tab-label">{label}</span>
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setMoreSheetOpen((prev) => !prev)}
            className={`mobile-tab ${isMoreActive ? 'active' : ''}`}
            aria-label="Mehr öffnen"
            aria-expanded={moreSheetOpen}
          >
            <FontAwesomeIcon icon={faGear} className="text-[22px]" />
            <span className="tab-label">Mehr</span>
          </button>
        </nav>
      )}
    </div>
  )
}
