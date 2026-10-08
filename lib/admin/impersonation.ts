import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const IMPERSONATION_COOKIE = 'anidocs_impersonation'

export type ImpersonationCookiePayload = {
  adminId: string
  adminEmail?: string | null
  targetId: string
  targetEmail?: string | null
  startedAt: string
}

export async function getActiveImpersonation(): Promise<ImpersonationCookiePayload | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(IMPERSONATION_COOKIE)?.value
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ImpersonationCookiePayload
    if (!parsed?.adminId || !parsed?.targetId) return null
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || user.id !== parsed.targetId) return null
    return parsed
  } catch {
    return null
  }
}
