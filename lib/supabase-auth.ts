import 'server-only'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { headers } from 'next/headers'

import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * Session aus Cookie (PWA) oder `Authorization: Bearer <access_token>` (Flutter/Mobile).
 */
export async function getSupabaseAndUser(): Promise<{
  supabase: SupabaseClient
  user: User | null
}> {
  const h = await headers()
  const auth = h.get('authorization')
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7).trim()
    if (!token) {
      const supabase = await createSupabaseServerClient()
      return { supabase, user: null }
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY müssen gesetzt sein.')
    }
    const supabase = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
    const { data } = await supabase.auth.getUser(token)
    return { supabase, user: data.user }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}
