import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { isAdminUserId } from '@/lib/admin/config'
import { fetchAdminUserDirectoryStats } from '@/lib/admin/data'

/** Liefert, ob die Session Admin ist; optional Nutzeranzahl für Sidebar-Badge. */
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ admin: false })
  }
  if (!isAdminUserId(user.id)) {
    return NextResponse.json({ admin: false })
  }
  let userCount: number | undefined
  try {
    const stats = await fetchAdminUserDirectoryStats()
    userCount = stats.total
  } catch {
    userCount = undefined
  }
  return NextResponse.json({ admin: true, userCount })
}
