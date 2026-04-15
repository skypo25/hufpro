'use client'

import { useEffect, useId, useState } from 'react'

import { useConsent } from '@/lib/consent/useConsent'
import type { ConsentRecord } from '@/lib/consent/consent'

import './consent-ui.css'

type InnerProps = {
  consent: ConsentRecord | null
  closeSettings: () => void
  updateConsent: (partial: Partial<Pick<ConsentRecord, 'analytics' | 'maps' | 'marketing'>>) => void
  acceptAll: () => void
}

/** Eigener Mount pro Öffnen → Formularzustand ohne setState im Effect synchronisieren */
function CookieSettingsModalInner({ consent, closeSettings, updateConsent, acceptAll }: InnerProps) {
  const titleId = useId()
  const [analytics, setAnalytics] = useState(() => consent?.analytics ?? false)
  const [maps, setMaps] = useState(() => consent?.maps ?? false)
  const [marketing, setMarketing] = useState(() => consent?.marketing ?? false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettings()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closeSettings])

  const save = () => {
    updateConsent({ analytics, maps, marketing })
    closeSettings()
  }

  return (
    <div
      className="ad-consent-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSettings()
      }}
    >
      <div
        className="ad-consent-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>Cookie- &amp; Privatsphäre-Einstellungen</h2>
        <p className="ad-consent-modal__lead">
          Wir setzen nur dann nicht notwendige Dienste ein, wenn Sie zustimmen. Sie können Ihre Auswahl jederzeit
          ändern.
        </p>

        <div className="ad-consent-field">
          <input type="checkbox" id="ad-consent-essential" checked disabled />
          <label htmlFor="ad-consent-essential">
            <span className="ad-consent-field__title">Notwendig</span>
            <span className="ad-consent-field__hint">
              Erforderlich für Sicherheit und Grundfunktionen der Website. Kann nicht abgewählt werden.
            </span>
          </label>
        </div>

        <div className="ad-consent-field">
          <input
            type="checkbox"
            id="ad-consent-analytics"
            checked={analytics}
            onChange={(e) => setAnalytics(e.target.checked)}
          />
          <label htmlFor="ad-consent-analytics">
            <span className="ad-consent-field__title">Statistik / Analytics</span>
            <span className="ad-consent-field__hint">Hilft uns, Nutzung anonym auszuwerten (derzeit nicht aktiv).</span>
          </label>
        </div>

        <div className="ad-consent-field">
          <input type="checkbox" id="ad-consent-maps" checked={maps} onChange={(e) => setMaps(e.target.checked)} />
          <label htmlFor="ad-consent-maps">
            <span className="ad-consent-field__title">Karten (Mapbox)</span>
            <span className="ad-consent-field__hint">Lädt interaktive Karten von Mapbox (USA). Ohne Zustimmung keine Karte.</span>
          </label>
        </div>

        <div className="ad-consent-field">
          <input
            type="checkbox"
            id="ad-consent-marketing"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
          />
          <label htmlFor="ad-consent-marketing">
            <span className="ad-consent-field__title">Marketing</span>
            <span className="ad-consent-field__hint">Für spätere Marketing- oder Remarketing-Tools (derzeit nicht aktiv).</span>
          </label>
        </div>

        <div className="ad-consent-modal__foot">
          <button type="button" className="ad-consent-btn ad-consent-btn--ghost" onClick={closeSettings}>
            Abbrechen
          </button>
          <button type="button" className="ad-consent-btn ad-consent-btn--primary" onClick={save}>
            Speichern
          </button>
          <button type="button" className="ad-consent-btn ad-consent-btn--muted" onClick={acceptAll}>
            Alle akzeptieren
          </button>
        </div>
      </div>
    </div>
  )
}

export function CookieSettingsModal() {
  const { settingsOpen, settingsMountKey, closeSettings, consent, updateConsent, acceptAll } = useConsent()

  if (!settingsOpen) return null

  return (
    <CookieSettingsModalInner
      key={settingsMountKey}
      consent={consent}
      closeSettings={closeSettings}
      updateConsent={updateConsent}
      acceptAll={acceptAll}
    />
  )
}
