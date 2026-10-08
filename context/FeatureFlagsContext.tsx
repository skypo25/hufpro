'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  isFeatureEnabled,
  type AdminFeatureFlagKey,
  type UserFeatureFlags,
} from '@/lib/admin/featureFlagsShared'

type FeatureFlagsContextValue = {
  loading: boolean
  enabled: Record<AdminFeatureFlagKey, boolean>
  has: (key: AdminFeatureFlagKey) => boolean
}

const defaultEnabled: Record<AdminFeatureFlagKey, boolean> = {
  ai_assistant: true,
  photo_compare: true,
  invoices: true,
  beta: false,
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | undefined>(undefined)

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(defaultEnabled)

  useEffect(() => {
    let cancelled = false
    fetch('/api/me/feature-flags', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return null
        return res.json()
      })
      .then((data) => {
        if (cancelled || !data?.enabled) return
        setEnabled({
          ai_assistant: Boolean(data.enabled.ai_assistant),
          photo_compare: Boolean(data.enabled.photo_compare),
          invoices: Boolean(data.enabled.invoices),
          beta: Boolean(data.enabled.beta),
        })
      })
      .catch(() => {
        // Defaults bleiben aktiv (Kernfunktionen).
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<FeatureFlagsContextValue>(
    () => ({
      loading,
      enabled,
      has: (key) => enabled[key] === true,
    }),
    [loading, enabled]
  )

  return (
    <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>
  )
}

export function useFeatureFlags(): FeatureFlagsContextValue {
  const ctx = useContext(FeatureFlagsContext)
  if (!ctx) {
    // Fallback ohne Provider: Kern an, Beta aus
    return {
      loading: false,
      enabled: defaultEnabled,
      has: (key) => isFeatureEnabled(defaultEnabled as UserFeatureFlags, key),
    }
  }
  return ctx
}
