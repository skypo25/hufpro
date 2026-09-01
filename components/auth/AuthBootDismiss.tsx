'use client'

import { useEffect } from 'react'
import { hideAnidocsBootSplash, signalAnidocsShellReady } from '@/lib/mobile/shellReady'

/** Auth-Seiten: Boot-Splash ausblenden, falls App-Logout während des Ladens passierte. */
export default function AuthBootDismiss() {
  useEffect(() => {
    signalAnidocsShellReady()
    hideAnidocsBootSplash()
  }, [])

  return null
}
