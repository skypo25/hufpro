'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/users', label: 'Nutzer' },
  { href: '/admin/system', label: 'System' },
] as const

export default function AdminSubNav(props: { userCount?: number }) {
  const pathname = usePathname()

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-[#E5E2DC] pb-4" aria-label="Admin-Navigation">
      {LINKS.map((l) => {
        const active =
          l.href === '/admin' ? pathname === '/admin' : pathname === l.href || pathname.startsWith(`${l.href}/`)
        const showBadge = l.href === '/admin/users' && typeof props.userCount === 'number'
        return (
          <Link
            key={l.href}
            href={l.href}
            className={[
              'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition',
              active
                ? 'bg-[rgba(82,183,136,.12)] text-[#2d8a63]'
                : 'text-[#6B7280] hover:bg-[rgba(0,0,0,.04)] hover:text-[#1B1F23]',
            ].join(' ')}
          >
            {l.label}
            {showBadge ? (
              <span className="min-w-[18px] rounded-full bg-[#3B82F6] px-1.5 py-0.5 text-center text-[9px] font-bold leading-none text-white">
                {props.userCount! > 999 ? '999+' : props.userCount}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
