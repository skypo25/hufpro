'use client'

import Image from 'next/image'
import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

import { CookieFooterButton } from '@/components/consent/CookieFooterButton'
import { DirectoryPublicNav } from '@/components/directory/public/DirectoryPublicNav'
import { directoryAppBaseUrl, directoryProfileCreateHref } from '@/lib/directory/public/appBaseUrl'
import { listingQueryHasActiveFilters, parseBehandlerListingQuery } from '@/lib/directory/public/listingParams'
import { writeBehandlerListingReturnPath } from '@/lib/directory/public/listingReturnUrl'

function DirectoryPublicFooter() {
  const base = directoryAppBaseUrl()
  const profileCreateHref = directoryProfileCreateHref()
  return (
    <footer className="beh-footer">
      <div className="footer-inner">
        <div className="footer-logo">
          <Image src="/logo.svg" alt="anidocs" width={120} height={40} className="h-7 w-auto object-contain" />
        </div>
        <div className="footer-links">
          <a href={base}>App</a>
          <a href={`${base}/hilfe`}>Hilfe</a>
          <a href={profileCreateHref}>Für Behandler</a>
          <a href={`${base}/datenschutz`}>Datenschutz</a>
          <a href={`${base}/impressum`}>Impressum</a>
          <CookieFooterButton />
        </div>
        <div className="footer-copy">© 2026 anidocs · anidocs.de · Made in Germany</div>
      </div>
    </footer>
  )
}

function DirectoryPublicChromeInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const searchParams = useSearchParams()
  const listingSearchSig = searchParams.toString()
  const listingPath = pathname === '/behandler'

  useEffect(() => {
    if (pathname !== '/behandler') return
    const path = listingSearchSig ? `/behandler?${listingSearchSig}` : '/behandler'
    writeBehandlerListingReturnPath(path)
  }, [pathname, listingSearchSig])
  const raw = Object.fromEntries(searchParams.entries())
  const q = parseBehandlerListingQuery(raw)
  const premiumListing = listingPath && listingQueryHasActiveFilters(q)

  if (premiumListing) {
    // Premium Listing rendert eigenes Layout/Navigation; wir liefern nur den äußeren Rahmen + Footer,
    // damit Footer & untere Abschnitte konsistent wie auf der Verzeichnis-Startseite wirken.
    return (
      <div className="beh-ref min-h-screen w-full">
        <main className="dir-site-main">{children}</main>
        <DirectoryPublicFooter />
      </div>
    )
  }

  return (
    <div className="beh-ref min-h-screen w-full">
      <DirectoryPublicNav listingHome={listingPath} />
      <main className="dir-site-main">{children}</main>
      <DirectoryPublicFooter />
    </div>
  )
}

function ChromeSuspenseFallback({ children }: { children: React.ReactNode }) {
  return (
    <div className="beh-ref min-h-screen w-full">
      <DirectoryPublicNav listingHome />
      <main className="dir-site-main">{children}</main>
    </div>
  )
}

export function DirectoryPublicChrome({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ChromeSuspenseFallback>{children}</ChromeSuspenseFallback>}>
      <DirectoryPublicChromeInner>{children}</DirectoryPublicChromeInner>
    </Suspense>
  )
}
