import { NextResponse } from 'next/server'
import { getSupabaseAndUser } from '@/lib/supabase-auth'

type RouteParams = { params: Promise<{ id: string }> }

/** ZUGFeRD pro Rechnung ein-/ausschalten. */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { user, supabase } = await getSupabaseAndUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }

  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as { enabled?: unknown }
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled (boolean) fehlt.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('invoices')
    .update({
      zugferd_enabled: body.enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, zugferd_enabled')
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'Rechnung nicht gefunden.' }, { status: 404 })
  }

  return NextResponse.json({
    id: data.id,
    zugferdEnabled: data.zugferd_enabled === true,
  })
}
