'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import MobileFab from './MobileFab'
import {
  faTableCellsLarge,
  faCalendarDays,
  faHorse,
  faUsers,
  faGear,
} from '@fortawesome/free-solid-svg-icons'

const NAV_ITEMS: { href: string; label: string; icon: typeof faTableCellsLarge; badge?: number }[] = [
  { href: '/dashboard', label: 'Start', icon: faTableCellsLarge },
  { href: '/calendar', label: 'Termine', icon: faCalendarDays, badge: 2 },
  { href: '/horses', label: 'Pferde', icon: faHorse },
  { href: '/customers', label: 'Kunden', icon: faUsers },
  { href: '/settings', label: 'Mehr', icon: faGear },
]

export default function MobileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="mobile-app flex min-h-screen flex-col md:hidden">
      {/* Hauptinhalt – Header kommt von der jeweiligen Seite (z. B. MobileDashboard) */}
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>

      {/* FAB nur auf Nicht-Formular-Seiten zeigen */}
      {!/\/records\/(new|[^/]+\/edit)$/.test(pathname ?? '') && <MobileFab />}

      <nav className="mobile-tab-bar" aria-label="Hauptnavigation">
        {NAV_ITEMS.map(({ href, label, icon, badge }) => {
          const isActive = href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)
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
      </nav>
    </div>
  )
}
