'use client'

import Sidebar from '@/components/Sidebar'
import { AppProfileProvider } from '@/context/AppProfileContext'
import { SidebarProvider, useSidebarContext } from '@/context/SidebarContext'
import { useIsMobile } from '@/components/mobile/useIsMobile'
import { useMobileContent } from '@/components/mobile/mobileRouteMap'
import MobileShell from '@/components/mobile/MobileShell'
import BillingSystemBanner from '@/components/billing/BillingSystemBanner'

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
  const mobileContent = useMobileContent()

  return (
    <AppProfileProvider>
      {isMobile ? (
        <MobileShell>{mobileContent}</MobileShell>
      ) : (
        <DesktopLayout>{children}</DesktopLayout>
      )}
    </AppProfileProvider>
  )
}
