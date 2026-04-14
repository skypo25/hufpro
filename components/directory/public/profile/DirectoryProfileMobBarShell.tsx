'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/** Blendet die feste Mobilleiste aus, wenn der Kontaktbereich sichtbar ist (weniger Doppel-CTA). */
export function DirectoryProfileMobBarShell({
  children,
  className,
  'aria-label': ariaLabel,
}: {
  children: ReactNode
  className?: string
  'aria-label'?: string
}) {
  const ref = useRef<HTMLNavElement>(null)

  useEffect(() => {
    const bar = ref.current
    const kontakt = document.getElementById('profil-kontakt')
    if (!bar || !kontakt) return

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          bar.classList.toggle('dir-prof-v2-mob-bar--peek-kontakt', e.isIntersecting)
        }
      },
      { threshold: 0.22, rootMargin: '0px 0px -12% 0px' }
    )
    io.observe(kontakt)
    return () => io.disconnect()
  }, [])

  return (
    <nav ref={ref} className={className} aria-label={ariaLabel}>
      {children}
    </nav>
  )
}
