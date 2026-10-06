import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * Request-scoped Dedup: mehrere Server Components in einem Render
 * teilen sich denselben user_settings-Read (kein Cross-Request-Cache).
 */
export const getUserSettingsCached = cache(async (userId: string) => {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', userId)
    .maybeSingle()
  return (data?.settings ?? null) as Record<string, unknown> | null
})
