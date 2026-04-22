'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faAddressBook,
  faMagnifyingGlass,
  faChevronLeft,
  faBars,
  faChartColumn,
} from '@fortawesome/free-solid-svg-icons'
import LogoutButton from '@/components/LogoutButton'
import { supabase } from '@/lib/supabase-client'
import { SidebarProvider, useSidebarContext } from '@/context/SidebarContext'
import { MainWithMargin } from '@/components/layout/MainWithMargin'

const SIDEBAR_WIDTH = 260
const SIDEBAR_COLLAPSED_WIDTH = 72

type NavChild = { label: string; href: string; exact: boolean; icon: typeof faChartColumn }

type NavBlock =
  | {
      kind: 'group'
      label: string
      href: string
      icon: typeof faAddressBook
      exact: boolean
      children: readonly NavChild[]
    }
  | {
      kind: 'link'
      label: string
      href: string
      icon: typeof faMagnifyingGlass
      exact: boolean
    }

const NAV_BLOCKS: readonly NavBlock[] = [
  {
    kind: 'group',
    label: 'Mein Profil',
    href: '/directory/mein-profil',
    icon: faAddressBook,
    exact: true,
    children: [{ label: 'Statistik', href: '/directory/statistik', exact: true, icon: faChartColumn }],
  },
  {
    kind: 'link',
    label: 'Öffentliches Verzeichnis',
    href: '/behandler',
    icon: faMagnifyingGlass,
    exact: false,
  },
] as const

function isItemActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

function DirectoryVerzeichnisInternSidebar({ paketLabel }: { paketLabel: 'gratis' | 'premium' | null }) {
  const pathname = usePathname()
  const { isCollapsed, toggleSidebar } = useSidebarContext()
  const [userDisplay, setUserDisplay] = useState<{
    name: string
    initials: string
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const {
        data: { user: u },
      } = await supabase.auth.getUser()
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

  return (
    <aside
      className="fixed left-[15px] z-50 hidden flex-col overflow-hidden rounded-xl bg-[#1B1F23] text-white shadow-lg transition-[width] duration-200 ease-out min-[960px]:flex"
      style={{
        width: isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        top: 'calc(15px + env(safe-area-inset-top, 0px))',
        bottom: 'calc(15px + env(safe-area-inset-bottom, 0px))',
      }}
      aria-label="Verzeichnis"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 pb-4 pt-5">
        <div className="flex min-w-0 items-center gap-3">
          {isCollapsed ? (
            <Image src="/logo.svg" alt="Logo" width={32} height={32} className="shrink-0" />
          ) : (
            <Image src="/logo.svg" alt="Logo" width={120} height={36} className="h-9 w-auto shrink-0 object-contain" />
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

      {!isCollapsed && paketLabel ? (
        <div className="shrink-0 border-b border-white/10 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Paket</div>
          <div className="mt-1 inline-block rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/90">
            {paketLabel === 'premium' ? 'Premium' : 'Gratis'}
          </div>
        </div>
      ) : null}

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className={isCollapsed ? 'mb-4' : 'mb-6'}>
          {!isCollapsed && (
            <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Verzeichnis</div>
          )}
          <div className="space-y-[2px]">
            {NAV_BLOCKS.map((block) => {
              if (block.kind === 'link') {
                const active = pathname ? isItemActive(pathname, block.href, block.exact) : false
                return (
                  <Link
                    key={block.href}
                    href={block.href}
                    title={isCollapsed ? block.label : undefined}
                    className={[
                      'group relative flex items-center rounded-lg px-3 py-2.5 text-[14px] transition-all duration-150',
                      isCollapsed ? 'justify-center' : 'gap-3',
                      active
                        ? 'bg-[#3d3f44] text-white shadow-sm'
                        : 'text-white/65 hover:bg-[#31373e] hover:text-white',
                    ].join(' ')}
                    aria-current={active ? 'page' : undefined}
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
                      icon={block.icon}
                      className={[
                        'shrink-0 transition-transform duration-150',
                        active ? 'opacity-100' : 'opacity-80 group-hover:scale-[1.04]',
                      ].join(' ')}
                      style={{ width: 16, height: 16, minWidth: 16 }}
                    />
                    {!isCollapsed && <span className="min-w-0 flex-1 truncate font-medium">{block.label}</span>}
                  </Link>
                )
              }

              const parentActive = pathname ? isItemActive(pathname, block.href, block.exact) : false
              return (
                <div key={block.label} className="space-y-[2px]">
                  <Link
                    href={block.href}
                    title={isCollapsed ? block.label : undefined}
                    className={[
                      'group relative flex items-center rounded-lg px-3 py-2.5 text-[14px] transition-all duration-150',
                      isCollapsed ? 'justify-center' : 'gap-3',
                      parentActive
                        ? 'bg-[#3d3f44] text-white shadow-sm'
                        : 'text-white/65 hover:bg-[#31373e] hover:text-white',
                    ].join(' ')}
                    aria-current={parentActive ? 'page' : undefined}
                  >
                    {!isCollapsed && (
                      <span
                        className={[
                          'absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full transition-opacity duration-150',
                          parentActive ? 'bg-white opacity-100' : 'opacity-0 group-hover:opacity-60',
                        ].join(' ')}
                      />
                    )}
                    <FontAwesomeIcon
                      icon={block.icon}
                      className={[
                        'shrink-0 transition-transform duration-150',
                        parentActive ? 'opacity-100' : 'opacity-80 group-hover:scale-[1.04]',
                      ].join(' ')}
                      style={{ width: 16, height: 16, minWidth: 16 }}
                    />
                    {!isCollapsed && <span className="min-w-0 flex-1 truncate font-medium">{block.label}</span>}
                  </Link>
                  {!isCollapsed &&
                    block.children.map((child) => {
                      const childActive = pathname ? isItemActive(pathname, child.href, child.exact) : false
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={[
                            'group relative flex items-center rounded-lg py-2 pl-9 pr-3 text-[13px] transition-all duration-150',
                            childActive
                              ? 'bg-[#3d3f44] text-white shadow-sm'
                              : 'text-white/55 hover:bg-[#31373e] hover:text-white',
                          ].join(' ')}
                          aria-current={childActive ? 'page' : undefined}
                        >
                          <span
                            className={[
                              'absolute left-[18px] top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full transition-opacity duration-150',
                              childActive ? 'bg-white opacity-100' : 'opacity-0 group-hover:opacity-60',
                            ].join(' ')}
                          />
                          <FontAwesomeIcon
                            icon={child.icon}
                            className={[
                              'mr-2.5 shrink-0 transition-transform duration-150',
                              childActive ? 'opacity-100' : 'opacity-75 group-hover:scale-[1.04]',
                            ].join(' ')}
                            style={{ width: 14, height: 14, minWidth: 14 }}
                          />
                          <span className="min-w-0 flex-1 truncate font-medium">{child.label}</span>
                        </Link>
                      )
                    })}
                </div>
              )
            })}
          </div>
        </div>
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

function DirectoryVerzeichnisMobileBar({ paketLabel }: { paketLabel: 'gratis' | 'premium' | null }) {
  const pathname = usePathname()
  return (
    <header
      className="sticky top-0 z-40 border-b border-white/10 bg-[#1B1F23] px-3 py-3 text-white shadow-md min-[960px]:hidden"
      style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
    >
      <div className="flex items-center justify-between gap-2">
        <Image src="/logo.svg" alt="AniDocs" width={100} height={30} className="h-7 w-auto shrink-0 object-contain" />
        {paketLabel ? (
          <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90">
            {paketLabel === 'premium' ? 'Premium' : 'Gratis'}
          </span>
        ) : null}
      </div>
      <nav className="mt-3 flex flex-wrap gap-2" aria-label="Verzeichnis">
        <Link
          href="/directory/mein-profil"
          className={[
            'rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
            pathname === '/directory/mein-profil'
              ? 'bg-[#3d3f44] text-white'
              : 'bg-white/5 text-white/80 hover:bg-white/10',
          ].join(' ')}
          aria-current={pathname === '/directory/mein-profil' ? 'page' : undefined}
        >
          Mein Profil
        </Link>
        <Link
          href="/directory/statistik"
          className={[
            'rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
            pathname === '/directory/statistik'
              ? 'bg-[#3d3f44] text-white'
              : 'bg-white/5 text-white/80 hover:bg-white/10',
          ].join(' ')}
          aria-current={pathname === '/directory/statistik' ? 'page' : undefined}
        >
          Statistik
        </Link>
        <Link
          href="/behandler"
          className={[
            'rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
            pathname === '/behandler' || (pathname ?? '').startsWith('/behandler/')
              ? 'bg-[#3d3f44] text-white'
              : 'bg-white/5 text-white/80 hover:bg-white/10',
          ].join(' ')}
          aria-current={
            pathname === '/behandler' || (pathname ?? '').startsWith('/behandler/') ? 'page' : undefined
          }
        >
          Öffentliches Verzeichnis
        </Link>
      </nav>
      <div className="mt-3 [&>button]:inline-flex [&>button]:w-full [&>button]:items-center [&>button]:justify-center [&>button]:rounded-lg [&>button]:border-0 [&>button]:bg-white/10 [&>button]:px-4 [&>button]:py-2.5 [&>button]:text-[13px] [&>button]:font-medium [&>button]:text-white">
        <LogoutButton />
      </div>
    </header>
  )
}

type Props = {
  children: React.ReactNode
  paketLabel?: 'gratis' | 'premium' | null
  readOnlyBanner?: { graceEndsAtIso: string } | null
}

export function DirectoryVerzeichnisInternLayout({
  children,
  paketLabel = null,
  readOnlyBanner = null,
}: Props) {
  return (
    <SidebarProvider>
      <div
        className="relative min-h-screen text-slate-900"
        style={{
          backgroundColor: '#f8f8f8',
        }}
      >
        <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{ background: 'rgba(248, 248, 248, 0.82)' }}
          aria-hidden
        />
        <DirectoryVerzeichnisMobileBar paketLabel={paketLabel} />
        <DirectoryVerzeichnisInternSidebar paketLabel={paketLabel} />
        <div className="relative z-10">
          <MainWithMargin readOnlyBanner={readOnlyBanner}>{children}</MainWithMargin>
        </div>
      </div>
    </SidebarProvider>
  )
}
