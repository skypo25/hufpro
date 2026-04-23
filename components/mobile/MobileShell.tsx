'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAppProfile } from '@/context/AppProfileContext'
import { animalsNavLabel } from '@/lib/appProfile'
import MobileFab from './MobileFab'
import MobileMoreSheet from './MobileMoreSheet'
import BillingSystemBanner from '@/components/billing/BillingSystemBanner'
import ReadOnlyGraceBanner from '@/components/billing/ReadOnlyGraceBanner'
import {
  faTableCellsLarge,
  faCalendarDays,
  faHorse,
  faPaw,
  faUsers,
  faGear,
} from '@fortawesome/free-solid-svg-icons'

export default function MobileShell({
  children,
  readOnlyBanner = null,
}: {
  children: React.ReactNode
  readOnlyBanner?: { graceEndsAtIso: string } | null
}) {
  const pathname = usePathname()
  const { profile } = useAppProfile()
  const animalsIcon = profile.terminology === 'tier' ? faPaw : faHorse
  const navLinkItems = useMemo(
    () => [
      { href: '/dashboard', label: 'Start', icon: faTableCellsLarge },
      { href: '/calendar', label: 'Termine', icon: faCalendarDays },
      { href: '/animals', label: animalsNavLabel(profile.terminology), icon: animalsIcon },
      { href: '/customers', label: 'Kunden', icon: faUsers },
    ],
    [profile.terminology, animalsIcon]
  )
  const [moreSheetOpen, setMoreSheetOpen] = useState(false)
  const [todayAppointmentCount, setTodayAppointmentCount] = useState(0)
  const showTabBar = !/\/(records\/(new|[^/]+\/edit)|customers\/(new|[^/]+\/edit)|animals\/new|animals\/[^/]+\/edit|animals\/[^/]+\/erstanamnese(\/edit)?)$/.test(
    pathname ?? ''
  )
  const isMoreActive = pathname?.startsWith('/settings') ?? false

  useEffect(() => {
    let cancelled = false
    const load = () => {
      fetch('/api/appointments/today-count', { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!cancelled && data?.count != null) setTodayAppointmentCount(data.count)
        })
        .catch(() => {})
    }
    load()
    const onVis = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return (
    <div className="mobile-app flex min-h-screen min-w-0 max-w-full flex-col overflow-x-clip">
      {/* Hauptinhalt – Header kommt von der jeweiligen Seite */}
      <div className="min-h-0 min-w-0 flex-1 overflow-x-clip overflow-y-auto">
        <BillingSystemBanner />
        {readOnlyBanner ? (
          <div className="px-4 pt-1 pb-1">
            <ReadOnlyGraceBanner graceEndsAtIso={readOnlyBanner.graceEndsAtIso} />
          </div>
        ) : null}
        {children}
      </div>

      {/* FAB nur auf Nicht-Formular-Seiten zeigen */}
      {showTabBar && <MobileFab />}

      {/* More-Sheet (Overlay + Menü) */}
      <MobileMoreSheet open={moreSheetOpen} onClose={() => setMoreSheetOpen(false)} />

      {/* Tab-Bar */}
      {showTabBar && (
        <nav className="mobile-tab-bar mobile-tab-bar-z" aria-label="Hauptnavigation">
          {navLinkItems.map(({ href, label, icon }) => {
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
