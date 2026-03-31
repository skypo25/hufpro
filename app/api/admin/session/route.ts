import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { isAdminUserId } from '@/lib/admin/config'

/** Liefert, ob die aktuelle Session ein Admin ist (für Sidebar-Link). */
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ admin: false })
  }
  return NextResponse.json({ admin: isAdminUserId(user.id) })
}
