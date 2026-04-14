'use client'

import type { AnchorHTMLAttributes } from 'react'

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  slug: string
}

/**
 * Zählt einen Klick auf die öffentliche Telefonnummer (ein Ereignis pro Klick).
 */
export function DirectoryProfileTrackedPhoneLink({ slug, onClick, children, ...rest }: Props) {
  return (
    <a
      {...rest}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented) return
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
