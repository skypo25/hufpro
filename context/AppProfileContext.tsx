'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase-client'
import { deriveAppProfile, type AppProfile } from '@/lib/appProfile'

const defaultProfile = deriveAppProfile(null, null)

type AppProfileContextValue = {
  profile: AppProfile
  loading: boolean
}

const AppProfileContext = createContext<AppProfileContextValue | undefined>(undefined)

export function AppProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AppProfile>(defaultProfile)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) {
          setProfile(defaultProfile)
          setLoading(false)
        }
        return
      }

      const { data } = await supabase
        .from('user_settings')
        .select('settings')
        .eq('user_id', user.id)
        .maybeSingle()

      const s = data?.settings as Record<string, unknown> | undefined
      if (!cancelled) {
        setProfile(deriveAppProfile(s?.profession, s?.animal_focus))
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(() => ({ profile, loading }), [profile, loading])

  return (
    <AppProfileContext.Provider value={value}>{children}</AppProfileContext.Provider>
  )
}

export function useAppProfile(): AppProfileContextValue {
  const ctx = useContext(AppProfileContext)
  if (ctx === undefined) {
    throw new Error('useAppProfile must be used within AppProfileProvider')
  }
  return ctx
}
