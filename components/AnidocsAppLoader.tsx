'use client'

import { useEffect } from 'react'
import { ANIDOCS_SHELL_READY_EVENT } from '@/lib/mobile/shellReady'

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
  useEffect(() => {
    const el = document.getElementById('anidocs-boot-splash')
    if (!el) return

    let shellReady = false
    let minElapsed = false
    let hidden = false

    const hide = () => {
      if (hidden || !shellReady || !minElapsed) return
      hidden = true
      el.classList.add('anidocs-boot-splash--hide')
      window.setTimeout(() => {
        el.remove()
      }, 380)
    }

    const markReady = () => {
      shellReady = true
      hide()
    }

    window.addEventListener(ANIDOCS_SHELL_READY_EVENT, markReady)

    const tMin = window.setTimeout(() => {
      minElapsed = true
      hide()
    }, MIN_VISIBLE_MS)

    // Login/Marketing: kein AppLayoutClient → nach kurzer Zeit freigeben
    const tNonApp = window.setTimeout(() => {
      if (!window.__ANIDOCS_EXPECT_SHELL__) {
        markReady()
      }
    }, NON_APP_FALLBACK_MS)

    const tMax = window.setTimeout(() => {
      markReady()
    }, MAX_WAIT_MS)

    return () => {
      window.removeEventListener(ANIDOCS_SHELL_READY_EVENT, markReady)
      window.clearTimeout(tMin)
      window.clearTimeout(tNonApp)
      window.clearTimeout(tMax)
    }
  }, [])

  return null
}
