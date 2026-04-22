'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { AppProfileProvider } from '@/context/AppProfileContext'
import { SidebarProvider } from '@/context/SidebarContext'
import { useIsMobile } from '@/components/mobile/useIsMobile'
import { AdminAppChromeMobile } from '@/components/admin/AdminAppChrome'
import { DirectoryVerzeichnisInternLayout } from '@/components/directory/intern/DirectoryVerzeichnisInternLayout'
import { MainWithMargin } from '@/components/layout/MainWithMargin'

const MobileAppBranch = dynamic(() => import('./mobile/MobileAppBranch'), {
  loading: () => (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-2 bg-[#f8f8f8] text-[14px] text-[#6B7280]">
      <span className="inline-block h-6 w-6 animate-pulse rounded-full bg-[#E5E2DC]" aria-hidden />
      App wird geladen…
    </div>
  ),
})

function DesktopLayout({
  children,
  readOnlyBanner,
}: {
  children: React.ReactNode
  readOnlyBanner: { graceEndsAtIso: string } | null
}) {
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
  const isMobile = useIsMobile()
  const pathname = usePathname()
  const isAdminSection = Boolean(pathname?.startsWith('/admin'))

  const useVerzeichnisIntern =
    !isAdminSection &&
    directoryInternChrome &&
    (accessScope === 'directory_only' || Boolean(pathname?.startsWith('/directory')))

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
        <AdminAppChromeMobile>{children}</AdminAppChromeMobile>
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
