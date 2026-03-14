import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const merged = { ...body } as Record<string, unknown>
  if (merged.smtpPassword === '' || merged.smtpPassword === undefined) {
    const { data: existing } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', user.id)
      .maybeSingle()
    const existingSettings = (existing?.settings ?? {}) as Record<string, unknown>
    if (existingSettings.smtpPassword) merged.smtpPassword = existingSettings.smtpPassword
  }

  const { error } = await supabase
    .from('user_settings')
    .upsert(
      { user_id: user.id, settings: merged, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )

  if (error) {
    const isMissingTable = /relation.*does not exist|Could not find the/.test(error.message)
    const message = isMissingTable
      ? 'Die Tabelle "user_settings" fehlt in der Datenbank. Bitte im Supabase-Dashboard unter SQL Editor die Migration ausführen (Datei: supabase/migrations/20250313000000_user_settings.sql).'
      : error.message
    return NextResponse.json({ error: message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
