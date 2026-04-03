'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ADMIN_APP_NAV_LINKS } from '@/lib/admin/adminNavLinks'

function isAdminNavActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin' || pathname === '/admin/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Mobile: unter /admin keine Kunden-Tab-Bar; kompakte Admin-Navigation + App-Router-children.
 * Desktop nutzt die normale Sidebar (nur Admin-Menüpunkte).
 */
export function AdminAppChromeMobile({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const [userCount, setUserCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/session')
      .then((r) => r.json())
      .then((d: { admin?: boolean; userCount?: number }) => {
        if (!cancelled && typeof d.userCount === 'number') setUserCount(d.userCount)
      })
      .catch(() => {
        if (!cancelled) setUserCount(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#f7f7f7] text-[#1B1F23]">
      <header
        className="sticky top-0 z-20 shrink-0 border-b border-[#E5E2DC] bg-white/95 backdrop-blur"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="flex items-center gap-2 font-[family-name:var(--font-outfit)] text-[15px] font-semibold tracking-tight text-[#1B1F23]">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#52b788] text-[13px] font-bold text-[#1b1f23]"
              aria-hidden
            >
              a
            </span>
            Admin
          </span>
          <Link href="/dashboard" className="shrink-0 text-[13px] font-medium text-[#52b788] hover:underline">
            Zur App
          </Link>
        </div>
        <nav
          className="flex gap-1 overflow-x-auto border-t border-[#F0EEEA] px-2 py-2"
          aria-label="Admin-Navigation"
        >
          {ADMIN_APP_NAV_LINKS.map((l) => {
            const active = isAdminNavActive(pathname, l.href)
            const badge = l.userCountBadge && typeof userCount === 'number'
            return (
              <Link
                key={l.href}
                href={l.href}
                className={[
                  'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition',
                  active
                    ? 'bg-[rgba(82,183,136,.12)] text-[#2d8a63]'
                    : 'text-[#6B7280] hover:bg-[rgba(0,0,0,.04)] hover:text-[#1B1F23]',
                ].join(' ')}
              >
                {l.label}
                {badge ? (
                  <span className="min-w-[18px] rounded-full bg-[#3B82F6] px-1.5 py-0.5 text-center text-[9px] font-bold leading-none text-white">
                    {userCount > 999 ? '999+' : userCount}
                  </span>
                ) : null}
              </Link>
            )
          })}
        </nav>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  )
}
