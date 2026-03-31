import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { isAdminUserId } from '@/lib/admin/config'

/** Server-only: nicht-Admin → Dashboard, nicht eingeloggt → Login */
export async function requireAdmin(): Promise<{ userId: string; email: string | null }> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  if (!isAdminUserId(user.id)) {
    redirect('/dashboard')
  }

  return { userId: user.id, email: user.email ?? null }
}
