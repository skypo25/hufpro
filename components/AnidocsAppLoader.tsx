'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import {
  ANIDOCS_SHELL_READY_EVENT,
  hideAnidocsBootSplash,
  isNonAppShellPath,
} from '@/lib/mobile/shellReady'

const MIN_VISIBLE_MS = 320
const NON_APP_FALLBACK_MS = 500
const MAX_WAIT_MS = 8000

declare global {
  interface Window {
    __ANIDOCS_EXPECT_SHELL__?: boolean
  }
}

/**
 * Steuert den statischen Boot-Splash aus `app/layout.tsx` (#anidocs-boot-splash).
 * Sofort sichtbar ohne Hydration; ausblenden erst wenn die App-Shell bereit ist
 * (oder Max-Timeout), nicht nach fester Kurzzeit → weniger weiße Lücken in der PWA.
 */
export default function AnidocsAppLoader() {
  const pathname = usePathname() ?? ''

  /** Nie länger als MAX_WAIT_MS blockieren (auch bei Route-Wechseln / hängendem Chunk-Load). */
  useEffect(() => {
    const t = window.setTimeout(() => hideAnidocsBootSplash(), MAX_WAIT_MS)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (isNonAppShellPath(pathname)) {
      hideAnidocsBootSplash()
      return
    }

    const markReady = () => hideAnidocsBootSplash()

    window.addEventListener(ANIDOCS_SHELL_READY_EVENT, markReady)

    const tMin = window.setTimeout(markReady, MIN_VISIBLE_MS)

    const tNonApp = window.setTimeout(() => {
      if (!window.__ANIDOCS_EXPECT_SHELL__) {
        markReady()
      }
    }, NON_APP_FALLBACK_MS)

    return () => {
      window.removeEventListener(ANIDOCS_SHELL_READY_EVENT, markReady)
      window.clearTimeout(tMin)
      window.clearTimeout(tNonApp)
    }
  }, [pathname])

  return null
}
