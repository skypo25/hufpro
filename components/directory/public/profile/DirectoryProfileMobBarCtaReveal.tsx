'use client'

import { useEffect, useState } from 'react'
import { DirectoryProfileTrackedPhoneLink } from './DirectoryProfileTrackedPhoneLink'

/**
 * Zeigt Anrufen / Nachricht in der Mobilleiste erst, wenn die obere Schnell-CTA (#dir-prof-quick-cta)
 * nicht mehr im Viewport liegt (kein doppeltes Nebeneinander oben und unten).
 */
export function DirectoryProfileMobBarCtaReveal({
  quickCtaRootId,
  slug,
  phoneTelHref,
  premiumContact,
}: {
  quickCtaRootId: string
  slug: string
  phoneTelHref: string | null
  premiumContact: boolean
}) {
  const [quickCtaInView, setQuickCtaInView] = useState(true)

  useEffect(() => {
    const el = document.getElementById(quickCtaRootId)
    if (!el) {
      setQuickCtaInView(false)
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          setQuickCtaInView(e.isIntersecting)
        }
      },
      { threshold: 0, rootMargin: '-4px 0px 0px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [quickCtaRootId])

  if (quickCtaInView) return null

  const showCall = Boolean(phoneTelHref)
  const showMsg = premiumContact
  const showKontakt = !showCall && !showMsg

  return (
    <div className="dir-prof-v2-mob-dup">
      {showCall ? (
        <DirectoryProfileTrackedPhoneLink
          slug={slug}
          href={phoneTelHref!}
          className="dir-prof-v2-ha dir-prof-v2-ha--dark dir-prof-v2-mob-dup-btn"
        >
          <i className="bi bi-telephone-fill" aria-hidden />
          Anrufen
        </DirectoryProfileTrackedPhoneLink>
      ) : null}
      {showMsg ? (
        <a href="#profil-kontakt" className="dir-prof-v2-ha dir-prof-v2-ha--p dir-prof-v2-mob-dup-btn">
          <i className="bi bi-envelope-fill" aria-hidden />
          Nachricht
        </a>
      ) : null}
      {showKontakt ? (
        <a href="#profil-kontakt" className="dir-prof-v2-ha dir-prof-v2-ha--p dir-prof-v2-mob-dup-btn">
          <i className="bi bi-link-45deg" aria-hidden />
          Kontakt
        </a>
      ) : null}
    </div>
  )
}
