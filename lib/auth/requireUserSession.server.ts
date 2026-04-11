import 'server-only'

import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase-server'

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServerClient>>

export type RequireUserSessionOk = {
  ok: true
  user: User
  supabase: SupabaseServer
}

export type RequireUserSessionFail = {
  ok: false
  response: NextResponse
}

/**
 * Gemeinsame Session-Prüfung für API-Route-Handler (Cookie-Session).
 * Gibt bei fehlendem User eine einheitliche 401-Antwort zurück.
 */
export async function requireUserSession(): Promise<RequireUserSessionOk | RequireUserSessionFail> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 }),
    }
  }
  return { ok: true, user, supabase }
}
