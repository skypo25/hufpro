import { createClient } from '@supabase/supabase-js'

/**
 * Server-only. Bypasses RLS. Nur für vertrauenswürdige Aktionen (z. B. Termin-Bestätigung per Token).
 * Niemals in Client-Code verwenden oder NEXT_PUBLIC_* für den Key setzen.
 */
export function createSupabaseServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY fehlt. In .env.local setzen: Supabase Dashboard → Project Settings → API → service_role (Secret key).'
    )
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
