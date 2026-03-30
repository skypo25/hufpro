'use client'

import dynamic from 'next/dynamic'
import Sidebar from '@/components/Sidebar'
import { AppProfileProvider } from '@/context/AppProfileContext'
import { SidebarProvider, useSidebarContext } from '@/context/SidebarContext'
import { useIsMobile } from '@/components/mobile/useIsMobile'
import BillingSystemBanner from '@/components/billing/BillingSystemBanner'

const MobileAppBranch = dynamic(() => import('./mobile/MobileAppBranch'), {
  loading: () => (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-2 bg-[#f7f7f7] text-[14px] text-[#6B7280]">
      <span className="inline-block h-6 w-6 animate-pulse rounded-full bg-[#E5E2DC]" aria-hidden />
      App wird geladen…
    </div>
  ),
})

function MainWithMargin({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebarContext()
  const mlClass = isCollapsed ? 'min-[960px]:ml-[87px]' : 'min-[960px]:ml-[275px]' // 15+72 / 15+260

  return (
    <div className={`min-h-screen transition-[margin-left] duration-200 ease-out ${mlClass}`}>
      <main className="min-h-screen p-6 md:p-8 xl:p-10">
        <div className="mx-0 w-full max-w-[1280px] min-w-0 space-y-4">
          <BillingSystemBanner />
          {children}
        </div>
      </main>
    </div>
  )
}

function DesktopLayout({ children }: { children: React.ReactNode }) {
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
          <MainWithMargin>{children}</MainWithMargin>
        </div>
      </div>
    </SidebarProvider>
  )
}

export default function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile()

  return (
    <AppProfileProvider>
      {isMobile ? <MobileAppBranch /> : <DesktopLayout>{children}</DesktopLayout>}
    </AppProfileProvider>
  )
}
