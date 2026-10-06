'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import {
  ANIDOCS_SHELL_READY_EVENT,
  hideAnidocsBootSplash,
  isNonAppShellPath,
  stripAnidocsBootSplashIfDismissed,
} from '@/lib/mobile/shellReady'

const MIN_VISIBLE_MS = 320
const NON_APP_FALLBACK_MS = 500
const MAX_WAIT_MS = 8000

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

  /**
   * router.refresh() rendert das Root-Layout neu und setzt den Boot-Splash wieder ein.
   * Der Loader-Effect (pathname) läuft dann nicht erneut — ohne Watcher bleibt das Logo.
   */
  useEffect(() => {
    stripAnidocsBootSplashIfDismissed()
    const obs = new MutationObserver(() => stripAnidocsBootSplashIfDismissed())
    obs.observe(document.body, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (window.__ANIDOCS_BOOT_DISMISSED__) {
      stripAnidocsBootSplashIfDismissed()
      return
    }

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
