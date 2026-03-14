'use client'

import Sidebar from '@/components/Sidebar'
import { SidebarProvider, useSidebarContext } from '@/context/SidebarContext'

function MainWithMargin({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebarContext()
  const mlClass = isCollapsed ? 'lg:ml-[87px]' : 'lg:ml-[275px]' // 15+72 / 15+260

  return (
    <div className={`min-h-screen transition-[margin-left] duration-200 ease-out ${mlClass}`}>
      <main className="min-h-screen p-6 md:p-8 xl:p-10">
        <div className="mx-0 max-w-[1280px] w-full">{children}</div>
      </main>
    </div>
  )
}

export default function AppLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div
        className="relative min-h-screen text-slate-900"
        style={{
          backgroundColor: '#F7F6F3',
          backgroundImage: 'url(/background.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      >
        {/* Leichter Overlay für bessere Lesbarkeit des Inhalts */}
        <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{ background: 'rgba(247, 246, 243, 0.82)' }}
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
