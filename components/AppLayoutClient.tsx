'use client'

import dynamic from 'next/dynamic'
import { useEffect, useLayoutEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { AppProfileProvider } from '@/context/AppProfileContext'
import { SidebarProvider } from '@/context/SidebarContext'
import { ANIDOCS_SHELL_COOKIE } from '@/lib/mobile/shellPreference'
import { signalAnidocsShellReady } from '@/lib/mobile/shellReady'
import { AdminAppChromeMobile } from '@/components/admin/AdminAppChrome'
import { DirectoryVerzeichnisInternLayout } from '@/components/directory/intern/DirectoryVerzeichnisInternLayout'
import { MainWithMargin } from '@/components/layout/MainWithMargin'

const MOBILE_BREAKPOINT = 960

const MobileAppBranch = dynamic(() => import('./mobile/MobileAppBranch'), {
  // Boot-Splash bleibt sichtbar, bis MobileShell signalisiert — kein zweites UI.
  loading: () => null,
})

function syncShellCookie(isMobile: boolean) {
  const value = isMobile ? 'mobile' : 'desktop'
  document.cookie = `${ANIDOCS_SHELL_COOKIE}=${value}; path=/; max-age=31536000; SameSite=Lax`
}

function DesktopLayout({
  children,
  readOnlyBanner,
}: {
  children: React.ReactNode
  readOnlyBanner: { graceEndsAtIso: string } | null
}) {
  useEffect(() => {
    signalAnidocsShellReady()
  }, [])

  return (
    <SidebarProvider>
      <div
        className="relative min-h-screen text-slate-900"
        style={{
          backgroundColor: '#f8f8f8',
        }}
      >
        <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{ background: 'rgba(248, 248, 248, 0.82)' }}
          aria-hidden
        />
        <Sidebar />
        <div className="relative z-10">
          <MainWithMargin readOnlyBanner={readOnlyBanner}>{children}</MainWithMargin>
        </div>
      </div>
    </SidebarProvider>
  )
}

function AdminMobileReady({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    signalAnidocsShellReady()
  }, [])
  return <AdminAppChromeMobile>{children}</AdminAppChromeMobile>
}

export default function AppLayoutClient({
  children,
  readOnlyBanner = null,
  accessScope = 'app',
  directoryInternChrome = false,
  directoryInternPaket = null,
}: {
  children: React.ReactNode
  readOnlyBanner?: { graceEndsAtIso: string } | null
  accessScope?: 'app' | 'directory_only'
  /** Gratis/Premium-Verzeichnis: Intern-Bereich mit Sidebar (Metadaten oder directory_only). */
  directoryInternChrome?: boolean
  directoryInternPaket?: 'gratis' | 'premium' | null
}) {
  // unknown bis Viewport gemessen — verhindert Desktop-Flash und weiße Lücke in der PWA
  const [shell, setShell] = useState<'unknown' | 'mobile' | 'desktop'>('unknown')
  const pathname = usePathname()
  const isAdminSection = Boolean(pathname?.startsWith('/admin'))

  useLayoutEffect(() => {
    window.__ANIDOCS_EXPECT_SHELL__ = true
    return () => {
      delete window.__ANIDOCS_EXPECT_SHELL__
    }
  }, [])

  useLayoutEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT
      setShell(mobile ? 'mobile' : 'desktop')
      syncShellCookie(mobile)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const useVerzeichnisIntern =
    shell !== 'unknown' &&
    !isAdminSection &&
    directoryInternChrome &&
    (accessScope === 'directory_only' || Boolean(pathname?.startsWith('/directory')))

  useEffect(() => {
    if (useVerzeichnisIntern) {
      signalAnidocsShellReady()
    }
  }, [useVerzeichnisIntern])

  if (shell === 'unknown') {
    return null
  }

  const isMobile = shell === 'mobile'

  if (useVerzeichnisIntern) {
    return (
      <AppProfileProvider>
        <DirectoryVerzeichnisInternLayout paketLabel={directoryInternPaket} readOnlyBanner={readOnlyBanner}>
          {children}
        </DirectoryVerzeichnisInternLayout>
      </AppProfileProvider>
    )
  }

  if (isAdminSection && isMobile) {
    return (
      <AppProfileProvider>
        <AdminMobileReady>{children}</AdminMobileReady>
      </AppProfileProvider>
    )
  }

  return (
    <AppProfileProvider>
      {isMobile ? (
        <MobileAppBranch readOnlyBanner={readOnlyBanner} />
      ) : (
        <DesktopLayout readOnlyBanner={readOnlyBanner}>{children}</DesktopLayout>
      )}
    </AppProfileProvider>
  )
}
