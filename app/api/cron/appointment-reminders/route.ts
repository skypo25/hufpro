import { NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { processAppointmentReminders } from '@/lib/reminders/processAppointmentReminders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Geplanter Aufruf (z. B. Vercel Cron) mit Authorization: Bearer CRON_SECRET.
 * Läuft mit Service Role und versendet fällige Termin-Erinnerungen.
 */
export async function GET(request: Request) {
  const secret =
    process.env.CRON_SECRET ?? process.env.APPOINTMENT_REMINDER_CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createSupabaseServiceRoleClient()
    const out = await processAppointmentReminders(supabase)
    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      ...out,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
