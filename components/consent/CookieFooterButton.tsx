'use client'

import { useConsent } from '@/lib/consent/useConsent'

import './consent-ui.css'

/** Inline-Link/Button für Footer (z. B. neben Impressum) */
export function CookieFooterButton({ className }: { className?: string }) {
  const { openSettings } = useConsent()
  return (
    <button type="button" className={`ad-consent-footer-link${className ? ` ${className}` : ''}`} onClick={openSettings}>
      Cookie-Einstellungen
    </button>
  )
}
