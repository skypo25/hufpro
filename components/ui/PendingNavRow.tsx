'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

/**
 * Listenzeile mit Overlay-Link: sofortiges visuelles Feedback beim Klick,
 * bis die Zielroute geladen ist.
 */
export default function PendingNavRow({
  href,
  ariaLabel,
  className,
  children,
}: {
  href: string
  ariaLabel: string
  className?: string
  children: ReactNode
}) {
  const pathname = usePathname()
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setPending(false)
  }, [pathname])

  return (
    <div
      className={[className, pending ? 'bg-[rgba(1,85,85,0.07)]' : null].filter(Boolean).join(' ')}
      aria-busy={pending || undefined}
    >
      <Link
        href={href}
        className="absolute inset-0 z-0"
        aria-label={ariaLabel}
        onClick={() => setPending(true)}
      />
      {children}
    </div>
  )
}
