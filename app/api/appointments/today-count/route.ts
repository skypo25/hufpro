import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

function getBerlinDateKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const todayKey = getBerlinDateKey(now)
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const { data: rows } = await supabase
    .from('appointments')
    .select('id, appointment_date')
    .eq('user_id', user.id)
    .not('appointment_date', 'is', null)
    .gte('appointment_date', yesterday.toISOString())
    .lte('appointment_date', tomorrow.toISOString())

  const count = (rows ?? []).filter(
    (r) => r.appointment_date && getBerlinDateKey(new Date(r.appointment_date)) === todayKey
  ).length

  return NextResponse.json({ count })
}
