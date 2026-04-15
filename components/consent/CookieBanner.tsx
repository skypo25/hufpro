'use client'

import { useConsent } from '@/lib/consent/useConsent'

import './consent-ui.css'

export function CookieBanner() {
  const { needsBanner, acceptAll, acceptNecessary, openSettings } = useConsent()

  if (!needsBanner) return null

  return (
    <div className="ad-consent-banner" role="region" aria-label="Cookie-Hinweis">
      <div className="ad-consent-banner__inner">
        <p className="ad-consent-banner__text">
          Wir verwenden Cookies und ähnliche Techniken für notwendige Funktionen. Für Karten (Mapbox), Statistik oder
          Marketing benötigen wir Ihre Einwilligung — erst danach werden diese Dienste geladen.
        </p>
        <div className="ad-consent-banner__actions">
          <button type="button" className="ad-consent-btn ad-consent-btn--primary" onClick={acceptAll}>
            Alle akzeptieren
          </button>
          <button type="button" className="ad-consent-btn ad-consent-btn--ghost" onClick={acceptNecessary}>
            Nur notwendige
          </button>
          <button type="button" className="ad-consent-btn ad-consent-btn--muted" onClick={openSettings}>
            Einstellungen
          </button>
        </div>
      </div>
    </div>
  )
}
