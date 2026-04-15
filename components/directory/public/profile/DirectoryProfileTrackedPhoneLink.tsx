'use client'

import type { AnchorHTMLAttributes } from 'react'

import { useConsent } from '@/lib/consent/useConsent'

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  slug: string
}

/**
 * Zählt einen Klick auf die öffentliche Telefonnummer (ein Ereignis pro Klick).
 * Nur bei Einwilligung „Statistik / Analytics“.
 */
export function DirectoryProfileTrackedPhoneLink({ slug, onClick, children, ...rest }: Props) {
  const { hasConsent } = useConsent()

  return (
    <a
      {...rest}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented) return
        if (!hasConsent('analytics')) return
        void fetch('/api/directory/profile-analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, event: 'phone_click' }),
          keepalive: true,
        }).catch(() => {})
      }}
    >
      {children}
    </a>
  )
}
