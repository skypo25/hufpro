'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import LogoutButton from '@/components/LogoutButton'
import { AppProfileProvider } from '@/context/AppProfileContext'
import { SidebarProvider, useSidebarContext } from '@/context/SidebarContext'
import { useIsMobile } from '@/components/mobile/useIsMobile'
import BillingSystemBanner from '@/components/billing/BillingSystemBanner'
import ReadOnlyGraceBanner from '@/components/billing/ReadOnlyGraceBanner'
import { AdminAppChromeMobile } from '@/components/admin/AdminAppChrome'

const MobileAppBranch = dynamic(() => import('./mobile/MobileAppBranch'), {
  loading: () => (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-2 bg-[#f7f7f7] text-[14px] text-[#6B7280]">
      <span className="inline-block h-6 w-6 animate-pulse rounded-full bg-[#E5E2DC]" aria-hidden />
      App wird geladen…
    </div>
  ),
})

function MainWithMargin({
  children,
  readOnlyBanner,
}: {
  children: React.ReactNode
  readOnlyBanner: { graceEndsAtIso: string } | null
}) {
  const pathname = usePathname()
  const { isCollapsed } = useSidebarContext()
  const mlClass = isCollapsed ? 'min-[960px]:ml-[87px]' : 'min-[960px]:ml-[275px]' // 15+72 / 15+260
  const isAdmin = Boolean(pathname?.startsWith('/admin'))

  return (
    <div className={`min-h-screen transition-[margin-left] duration-200 ease-out ${mlClass}`}>
      <main className="min-h-screen p-6 md:p-8 xl:p-10">
        <div className="mx-0 w-full max-w-[1280px] min-w-0 space-y-4">
          {!isAdmin ? <BillingSystemBanner /> : null}
          {!isAdmin && readOnlyBanner ? <ReadOnlyGraceBanner graceEndsAtIso={readOnlyBanner.graceEndsAtIso} /> : null}
          {children}
        </div>
      </main>
    </div>
  )
}

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
          backgroundColor: '#f7f7f7',
        }}
      >
        <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{ background: 'rgba(247, 247, 247, 0.82)' }}
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

function DirectoryOnlyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f7f7] text-slate-900">
      <div className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1100px] items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-slate-900">AniDocs Verzeichnis</div>
            <div className="text-[11px] text-slate-500">Profilverwaltung</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/directory/mein-profil"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Mein Profil
            </Link>
            <a
              href="/behandler"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Öffentliches Verzeichnis
            </a>
            <LogoutButton />
          </div>
        </div>
      </div>
      <main className="mx-auto w-full max-w-[1100px] p-4 md:p-6">
        <div className="mx-0 w-full min-w-0 space-y-4">{children}</div>
      </main>
    </div>
  )
}

export default function AppLayoutClient({
  children,
  readOnlyBanner = null,
  accessScope = 'app',
}: {
  children: React.ReactNode
  readOnlyBanner?: { graceEndsAtIso: string } | null
  accessScope?: 'app' | 'directory_only'
}) {
  const isMobile = useIsMobile()
  const pathname = usePathname()
  const isAdminSection = Boolean(pathname?.startsWith('/admin'))

  if (!isAdminSection && accessScope === 'directory_only') {
    return (
      <AppProfileProvider>
        <DirectoryOnlyLayout>{children}</DirectoryOnlyLayout>
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
