'use client'

import { CookieBanner } from '@/components/consent/CookieBanner'
import { CookieSettingsModal } from '@/components/consent/CookieSettingsModal'
import { useConsent } from '@/lib/consent/useConsent'

import './consent-ui.css'

/** Schwebender Link zum Öffnen der Einstellungen, sobald eine Entscheidung gespeichert wurde */
function CookieReopenControl() {
  const { needsBanner, openSettings, hydrated } = useConsent()
  if (!hydrated || needsBanner) return null
  return (
    <button type="button" className="ad-consent-reopen" onClick={openSettings}>
      Cookie-Einstellungen
    </button>
  )
}

export function CookieConsentLayer() {
  return (
    <>
      <CookieBanner />
      <CookieSettingsModal />
      <CookieReopenControl />
    </>
  )
}
