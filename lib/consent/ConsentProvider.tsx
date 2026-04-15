'use client'

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  CONSENT_VERSION,
  getConsent,
  getDefaultConsent,
  hasConsent as hasConsentRecord,
  hasStoredConsentDecision,
  resetConsent as resetConsentStorage,
  setConsent as persistConsent,
  subscribeConsent,
  type ConsentCategory,
  type ConsentRecord,
} from '@/lib/consent/consent'
import { loadAnalytics } from '@/lib/consent/loadAnalytics'
import { loadMarketing } from '@/lib/consent/loadMarketing'

type ConsentContextValue = {
  consent: ConsentRecord | null
  hydrated: boolean
  /** Keine gültige gespeicherte Entscheidung → Banner zeigen */
  needsBanner: boolean
  settingsOpen: boolean
  openSettings: () => void
  /** Wechselt bei jedem Öffnen — für stabile Keys im Einstellungs-Modal */
  settingsMountKey: number
  closeSettings: () => void
  setConsent: (record: ConsentRecord) => void
  /** Teilaktualisierung auf Basis der aktuellen Werte */
  updateConsent: (partial: Partial<Pick<ConsentRecord, 'analytics' | 'maps' | 'marketing'>>) => void
  acceptAll: () => void
  acceptNecessary: () => void
  hasConsent: (category: ConsentCategory) => boolean
  resetConsent: () => void
}

const ConsentContext = createContext<ConsentContextValue | null>(null)

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsentState] = useState<ConsentRecord | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  /** Modal-Formular bei jedem Öffnen neu mounten (frischer State auch nach „Abbrechen“). */
  const [settingsMountKey, setSettingsMountKey] = useState(0)

  useEffect(() => {
    startTransition(() => {
      const stored = getConsent()
      if (stored && stored.consent_version !== CONSENT_VERSION) {
        resetConsentStorage()
        setConsentState(null)
      } else {
        setConsentState(stored)
      }
      setHydrated(true)
    })
    const unsub = subscribeConsent((next) => {
      setConsentState(next)
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (hasConsentRecord(consent, 'analytics')) {
      loadAnalytics()
    }
    if (hasConsentRecord(consent, 'marketing')) {
      loadMarketing()
    }
  }, [hydrated, consent])

  const setConsent = useCallback((record: ConsentRecord) => {
    persistConsent(record)
    setConsentState(record)
  }, [])

  const updateConsent = useCallback(
    (partial: Partial<Pick<ConsentRecord, 'analytics' | 'maps' | 'marketing'>>) => {
      const base = consent ?? getDefaultConsent()
      const next: ConsentRecord = {
        essential: true,
        analytics: partial.analytics ?? base.analytics,
        maps: partial.maps ?? base.maps,
        marketing: partial.marketing ?? base.marketing,
        timestamp: Date.now(),
        consent_version: CONSENT_VERSION,
      }
      persistConsent(next)
      setConsentState(next)
    },
    [consent]
  )

  const acceptAll = useCallback(() => {
    const next: ConsentRecord = {
      essential: true,
      analytics: true,
      maps: true,
      marketing: true,
      timestamp: Date.now(),
      consent_version: CONSENT_VERSION,
    }
    persistConsent(next)
    setConsentState(next)
    setSettingsOpen(false)
  }, [])

  const acceptNecessary = useCallback(() => {
    const next = getDefaultConsent()
    persistConsent(next)
    setConsentState(next)
    setSettingsOpen(false)
  }, [])

  const resetConsent = useCallback(() => {
    resetConsentStorage()
    setConsentState(null)
    setSettingsOpen(false)
  }, [])

  const openSettings = useCallback(() => {
    setSettingsMountKey((k) => k + 1)
    setSettingsOpen(true)
  }, [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  const hasConsentCb = useCallback(
    (category: ConsentCategory) => hasConsentRecord(consent, category),
    [consent]
  )

  const needsBanner = hydrated && !hasStoredConsentDecision(consent)

  const value = useMemo(
    () => ({
      consent,
      hydrated,
      needsBanner,
      settingsOpen,
      settingsMountKey,
      openSettings,
      closeSettings,
      setConsent,
      updateConsent,
      acceptAll,
      acceptNecessary,
      hasConsent: hasConsentCb,
      resetConsent,
    }),
    [
      consent,
      hydrated,
      needsBanner,
      settingsOpen,
      settingsMountKey,
      openSettings,
      closeSettings,
      setConsent,
      updateConsent,
      acceptAll,
      acceptNecessary,
      hasConsentCb,
      resetConsent,
    ]
  )

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext)
  if (!ctx) {
    throw new Error('useConsent muss innerhalb von ConsentProvider verwendet werden.')
  }
  return ctx
}
