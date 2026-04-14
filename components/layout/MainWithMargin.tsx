'use client'

import { usePathname } from 'next/navigation'
import { useSidebarContext } from '@/context/SidebarContext'
import BillingSystemBanner from '@/components/billing/BillingSystemBanner'
import ReadOnlyGraceBanner from '@/components/billing/ReadOnlyGraceBanner'

export function MainWithMargin({
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
