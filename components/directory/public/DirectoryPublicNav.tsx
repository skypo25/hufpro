'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { directoryAboutUrl, directoryProfileCreateHref } from '@/lib/directory/public/appBaseUrl'
import { readBehandlerListingReturnPath } from '@/lib/directory/public/listingReturnUrl'

/**
 * Gleiche Leiste wie auf der Startseite (`.beh-ref` nav in behandler-verzeichnis.css).
 * `listingHome`: Startseite liegt bereits in `.beh-ref.min-h-screen` (Chrome) — kein zweites `beh-ref`.
 */
export function DirectoryPublicNav({ listingHome = false }: { listingHome?: boolean }) {
  const pathname = usePathname() ?? ''
  const onListing = pathname === '/behandler'
  const isProfilePage = pathname.startsWith('/behandler/') && pathname !== '/behandler'
  const profileCreateHref = directoryProfileCreateHref()
  const aboutHref = directoryAboutUrl()
  const [menuOpen, setMenuOpen] = useState(false)
  const [listingBackHref, setListingBackHref] = useState('/behandler')

  useEffect(() => {
    if (!isProfilePage) return
    const stored = readBehandlerListingReturnPath()
    if (stored) setListingBackHref(stored)
  }, [isProfilePage, pathname])

  const closeMenu = useCallback(() => {
    setMenuOpen(false)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  const navUi = (
    <>
      <nav aria-label="Hauptnavigation">
        <div className="nav-inner">
          <Link href="/behandler" className="nav-logo">
            <Image
              src="/logo.svg"
              alt="anidocs"
              width={140}
              height={44}
              className="nav-logo-img"
              priority
            />
          </Link>
          {isProfilePage ? (
            <Link href={listingBackHref} className="nav-profile-back">
              <i className="bi bi-arrow-left" aria-hidden />
              Zurück zur Suche
            </Link>
          ) : null}
          <div className="nav-links">
            {onListing ? (
              <span className="nav-link active">Behandler finden</span>
            ) : (
              <Link href="/behandler" className="nav-link">
                Behandler finden
              </Link>
            )}
            <a href={profileCreateHref} className="nav-link">
              Für Behandler
            </a>
            <a href={aboutHref} className="nav-link">
              Über uns
            </a>
          </div>
          <a href={profileCreateHref} className="nav-cta">
            <i className="bi bi-plus-lg" aria-hidden />
            Profil erstellen
          </a>
          <button
            type="button"
            className="nav-burger"
            aria-label="Menü öffnen"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <i className="bi bi-list" aria-hidden />
          </button>
        </div>
      </nav>

      <div
        className={`mobile-menu${menuOpen ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menü"
        onClick={(e) => {
          const t = e.target as HTMLElement
          if (e.currentTarget === e.target || t.classList.contains('mm-overlay')) closeMenu()
        }}
      >
        <div className="mm-overlay" aria-hidden />
        <div className="mm-panel" onClick={(e) => e.stopPropagation()}>
          <div className="mm-header">
            <Link href="/behandler" className="nav-logo" onClick={closeMenu}>
              <Image
                src="/logo.svg"
                alt="anidocs"
                width={140}
                height={44}
                className="nav-logo-img"
                priority
              />
            </Link>
            <button type="button" className="mm-close" aria-label="Menü schließen" onClick={closeMenu}>
              <i className="bi bi-x-lg" aria-hidden />
            </button>
          </div>
          <div className="mm-links">
            <Link href="/behandler" className={`mm-link${onListing ? ' active' : ''}`} onClick={closeMenu}>
              <i className="bi bi-search" aria-hidden />
              Behandler finden
            </Link>
            <a href={profileCreateHref} className="mm-link" onClick={closeMenu}>
              <i className="bi bi-heart-pulse-fill" aria-hidden />
              Für Behandler
            </a>
            <a href={aboutHref} className="mm-link" onClick={closeMenu}>
              <i className="bi bi-info-circle-fill" aria-hidden />
              Über uns
            </a>
          </div>
          <div className="mm-footer">
            <a href={profileCreateHref} className="mm-cta" onClick={closeMenu}>
              <i className="bi bi-plus-lg" aria-hidden />
              Profil erstellen
            </a>
          </div>
        </div>
      </div>
    </>
  )

  if (listingHome) {
    return navUi
  }

  return <div className="beh-ref w-full">{navUi}</div>
}
