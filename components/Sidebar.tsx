'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import LogoutButton from './LogoutButton'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faHorse,
  faPaw,
  faUsers,
  faCalendarDays,
  faMagnifyingGlass,
  faTableCellsLarge,
  faGear,
  faFileInvoice,
  faCreditCard,
  faChevronLeft,
  faBars,
  faChartPie,
  faHouse,
  faAddressBook,
  faChartColumn,
} from '@fortawesome/free-solid-svg-icons'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useAppProfile } from '@/context/AppProfileContext'
import { animalsNavLabel } from '@/lib/appProfile'
import { useSidebarContext } from '@/context/SidebarContext'
import { ADMIN_APP_NAV_LINKS } from '@/lib/admin/adminNavLinks'

function buildNavGroups(animalsListLabel: string, animalsIcon: typeof faHorse) {
  return [
    {
      title: 'Allgemein',
      items: [{ label: 'Dashboard', href: '/dashboard', icon: faTableCellsLarge }],
    },
    {
      title: 'App',
      items: [
        { label: 'Kunden', href: '/customers', icon: faUsers },
        { label: animalsListLabel, href: '/animals', icon: animalsIcon },
        { label: 'Termine', href: '/calendar', icon: faCalendarDays },
        { label: 'Rechnungen', href: '/invoices', icon: faFileInvoice },
        { label: 'Billing', href: '/billing', icon: faCreditCard },
        { label: 'Suche', href: '/suche', icon: faMagnifyingGlass },
        { label: 'Einstellungen', href: '/settings', icon: faGear },
      ],
    },
    {
      title: 'Verzeichnis',
      items: [
        { label: 'Mein Profil', href: '/directory/mein-profil', icon: faAddressBook },
        { label: 'Statistik', href: '/directory/statistik', icon: faChartColumn },
      ],
    },
  ]
}

function isItemActive(pathname: string, href: string) {
  if (href === '/dashboard') {
    return pathname === '/dashboard'
  }
  if (href === '/admin') {
    return pathname === '/admin' || pathname === '/admin/'
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

type NavItem = { label: string; href: string; icon: typeof faTableCellsLarge }

function buildAdminNavGroups(adminUserCount: number | null): { title: string; items: NavItem[] }[] {
  const adminItems: NavItem[] = ADMIN_APP_NAV_LINKS.map((l) => ({
    label: l.label,
    href: l.href,
    icon:
      l.href === '/admin'
        ? faChartPie
        : l.href === '/admin/users'
          ? faUsers
          : l.href.startsWith('/admin/directory/')
            ? faAddressBook
            : faGear,
  }))

  const general = adminItems.filter((i) => i.href === '/admin')
  const directory = adminItems.filter((i) => i.href.startsWith('/admin/directory/'))
  const app = adminItems.filter((i) => i.href !== '/admin' && !i.href.startsWith('/admin/directory/'))

  const groups: { title: string; items: NavItem[] }[] = []
  if (general.length) groups.push({ title: 'Allgemein', items: general })
  if (directory.length) groups.push({ title: 'Verzeichnis', items: directory })
  if (app.length) groups.push({ title: 'App', items: app })

  groups.push({
    title: 'Wechseln',
    items: [{ label: 'Zur Anwendung', href: '/dashboard', icon: faHouse }],
  })

  return groups
}

const SIDEBAR_WIDTH = 260
const SIDEBAR_COLLAPSED_WIDTH = 72
const SIDEBAR_INSET = 15

export default function Sidebar() {
  const pathname = usePathname()
  const { isCollapsed, toggleSidebar } = useSidebarContext()
  const { profile } = useAppProfile()
  const [userDisplay, setUserDisplay] = useState<{
    name: string
    initials: string
  } | null>(null)
  const [showAdminNav, setShowAdminNav] = useState(false)
  const [adminUserCount, setAdminUserCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/session')
      .then((r) => r.json())
      .then((d: { admin?: boolean; userCount?: number }) => {
        if (cancelled) return
        setShowAdminNav(!!d.admin)
        setAdminUserCount(typeof d.userCount === 'number' ? d.userCount : null)
      })
      .catch(() => {
        if (!cancelled) {
          setShowAdminNav(false)
          setAdminUserCount(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u || cancelled) return
      const metaFirst = (u.user_metadata?.first_name as string) || ''
      const metaLast = (u.user_metadata?.last_name as string) || ''
      const { data: settingsRow } = await supabase
        .from('user_settings')
        .select('settings')
        .eq('user_id', u.id)
        .maybeSingle()
      const s = settingsRow?.settings as { firstName?: string; lastName?: string } | undefined
      const firstName = s?.firstName || metaFirst
      const lastName = s?.lastName || metaLast
      const name =
        [firstName, lastName].filter(Boolean).join(' ') ||
        u.email?.split('@')[0] ||
        'Benutzer'
      const initials =
        [firstName?.[0], lastName?.[0]].filter(Boolean).join('').toUpperCase().slice(0, 2) ||
        (u.email?.[0]?.toUpperCase() ?? '?')
      if (!cancelled) setUserDisplay({ name, initials })
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const animalsIcon = profile.terminology === 'tier' ? faPaw : faHorse
  const navGroups = useMemo(() => {
    if (pathname.startsWith('/admin')) {
      return buildAdminNavGroups(adminUserCount)
    }
    const base = buildNavGroups(animalsNavLabel(profile.terminology), animalsIcon)
    if (!showAdminNav) return base
    return base.map((group) =>
      group.title === 'System'
        ? {
            ...group,
            items: [...group.items, { label: 'Admin', href: '/admin', icon: faChartPie }],
          }
        : group
    )
  }, [pathname, profile.terminology, animalsIcon, showAdminNav, adminUserCount])

  return (
    <aside
      className="fixed left-[15px] z-50 hidden flex-col overflow-hidden rounded-xl bg-[#000d0d] text-white shadow-lg transition-[width] duration-200 ease-out min-[960px]:flex"
      style={{
        width: isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        top: 'calc(15px + env(safe-area-inset-top, 0px))',
        bottom: 'calc(15px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 pb-4 pt-5">
        <div className="flex min-w-0 items-center gap-3">
          {isCollapsed ? (
            <Image src="/logo-white.svg" alt="Logo" width={32} height={32} className="shrink-0" />
          ) : (
            <Image src="/logo-white.svg" alt="Logo" width={120} height={36} className="h-9 w-auto shrink-0 object-contain" />
          )}
        </div>
        {!isCollapsed && (
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/65 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Sidebar einklappen"
          >
            <FontAwesomeIcon icon={faChevronLeft} className="h-4 w-4" />
          </button>
        )}
      </div>

      {isCollapsed && (
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex shrink-0 items-center justify-center border-b border-white/10 py-3 text-white/65 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Sidebar aufklappen"
        >
          <FontAwesomeIcon icon={faBars} className="h-5 w-5" />
        </button>
      )}

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {navGroups.map((group) => (
          <div key={group.title} className={isCollapsed ? 'mb-4' : 'mb-6'}>
            {!isCollapsed && (
              <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                {group.title}
              </div>
            )}

            <div className="space-y-[2px]">
              {group.items.map((item) => {
                const active = isItemActive(pathname, item.href)
                const showUserBadge =
                  pathname.startsWith('/admin') &&
                  item.href === '/admin/users' &&
                  typeof adminUserCount === 'number'

                return (
                  <Link
                    key={`${group.title}-${item.href}`}
                    href={item.href}
                    title={isCollapsed ? item.label : undefined}
                    className={[
                      'group relative flex items-center rounded-lg px-3 py-2.5 text-[14px] transition-all duration-150',
                      isCollapsed ? 'justify-center' : 'gap-3',
                      active
                        ? 'bg-[#3d3f44] text-white shadow-sm'
                        : 'text-white/65 hover:bg-[#31373e] hover:text-white',
                    ].join(' ')}
                  >
                    {!isCollapsed && (
                      <span
                        className={[
                          'absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full transition-opacity duration-150',
                          active ? 'bg-white opacity-100' : 'opacity-0 group-hover:opacity-60',
                        ].join(' ')}
                      />
                    )}

                    <FontAwesomeIcon
                      icon={item.icon}
                      className={[
                        'shrink-0 transition-transform duration-150',
                        active ? 'opacity-100' : 'opacity-80 group-hover:scale-[1.04]',
                      ].join(' ')}
                      style={{ width: 16, height: 16, minWidth: 16 }}
                    />

                    {!isCollapsed && (
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-2 font-medium">
                        <span className="truncate">{item.label}</span>
                        {showUserBadge ? (
                          <span className="shrink-0 rounded-full bg-[#3B82F6] px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
                            {adminUserCount > 999 ? '999+' : adminUserCount}
                          </span>
                        ) : null}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-2">
        <div className={isCollapsed ? 'flex flex-col items-center gap-2' : 'rounded-lg px-3 py-2'}>
          <div className={isCollapsed ? 'flex flex-col items-center' : 'mb-3 flex items-center gap-3'}>
            <div
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#006d6d] text-[11px] font-bold text-white"
              title={userDisplay?.name ?? undefined}
              aria-label={userDisplay?.name ? `Profil: ${userDisplay.name}` : 'Profil wird geladen'}
            >
              {userDisplay?.initials ?? '…'}
            </div>

            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold text-white" title={userDisplay?.name ?? undefined}>
                  {userDisplay?.name ?? 'Laden…'}
                </div>
                <div className="text-[11px] text-white/45">Angemeldet</div>
              </div>
            )}
          </div>

          <div className="[&>button]:inline-flex [&>button]:w-full [&>button]:items-center [&>button]:justify-center [&>button]:rounded-lg [&>button]:border-0 [&>button]:bg-white/10 [&>button]:px-4 [&>button]:py-2.5 [&>button]:text-[13px] [&>button]:font-medium [&>button]:text-white [&>button]:transition-colors [&>button]:duration-150 [&>button]:hover:bg-white/15">
            <LogoutButton />
          </div>
        </div>
      </div>
    </aside>
  )
}