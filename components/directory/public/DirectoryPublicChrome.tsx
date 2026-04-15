'use client'

import Image from 'next/image'
import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

import { CookieFooterButton } from '@/components/consent/CookieFooterButton'
import { DirectoryPublicNav } from '@/components/directory/public/DirectoryPublicNav'
import { directoryAppBaseUrl, directoryProfileCreateHref } from '@/lib/directory/public/appBaseUrl'
import { listingQueryHasActiveFilters, parseBehandlerListingQuery } from '@/lib/directory/public/listingParams'
import { writeBehandlerListingReturnPath } from '@/lib/directory/public/listingReturnUrl'

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
    return <>{children}</>
  }

  const base = directoryAppBaseUrl()
  const profileCreateHref = directoryProfileCreateHref()
  const listingHome = listingPath

  if (listingHome) {
    return (
      <div className="beh-ref min-h-screen w-full">
        <DirectoryPublicNav listingHome />
        <main className="dir-site-main">{children}</main>
        <footer className="beh-footer">
          <div className="footer-inner">
            <div className="footer-logo">
              <div className="sq" aria-hidden>
                a
              </div>
              <span>anidocs</span>
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
      </div>
    )
  }

  return (
    <>
      <DirectoryPublicNav listingHome={false} />
      <main className="dir-site-main">{children}</main>
      <footer className="dir-site-footer">
        <div className="dir-sf-inner">
          <div className="dir-sf-logo">
            <Image
              src="/logo-white.svg"
              alt="anidocs"
              width={120}
              height={40}
              className="dir-sf-logo__img h-7 w-auto object-contain"
            />
          </div>
          <div className="dir-sf-links">
            <a href={base}>App</a>
            <a href={`${base}/hilfe`}>Hilfe</a>
            <a href={`${base}/datenschutz`}>Datenschutz</a>
            <a href={`${base}/impressum`}>Impressum</a>
            <CookieFooterButton />
          </div>
          <p className="dir-sf-copy">© 2026 anidocs · anidocs.de · Made in Germany</p>
        </div>
      </footer>
    </>
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
