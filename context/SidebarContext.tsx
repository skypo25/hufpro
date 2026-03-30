'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'anidocs-sidebar-collapsed'

type SidebarContextType = {
  /** effektiver Zustand: zwischen 960-1023px immer zugeklappt */
  isCollapsed: boolean
  toggleSidebar: () => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [windowWidth, setWindowWidth] = useState<number | null>(null)

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth)
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored !== null) setIsCollapsed(stored === 'true')
    } catch (_) {}
    setWindowWidth(window.innerWidth)
    setMounted(true)

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const narrowDesktop = windowWidth != null && windowWidth >= 960 && windowWidth < 1024
  const effectiveCollapsed = narrowDesktop ? true : isCollapsed

  const toggleSidebar = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, String(next))
      } catch (_) {}
      return next
    })
  }, [])

  return (
    <SidebarContext.Provider value={{ isCollapsed: effectiveCollapsed, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebarContext() {
  const ctx = useContext(SidebarContext)
  if (ctx === undefined) throw new Error('useSidebarContext must be used within SidebarProvider')
  return ctx
}
