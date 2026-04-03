import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { requireExportAccess } from '@/lib/export/exportAccess.server'
import { resolveDataExportRetentionDays } from '@/lib/systemSettings.server'
import { processDataExportJob } from '@/lib/export/runDataExportJob.server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Letzte Export-Jobs des Nutzers (für Download-Bereich in der App).
 */
export async function GET() {
  const gate = await requireExportAccess()
  if (!gate.ok) return gate.response

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('data_export_jobs')
    .select(
      'id, status, progress_percent, progress_label, error_message, completed_at, created_at, email_notified_at'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const retentionDays = await resolveDataExportRetentionDays()

  return NextResponse.json({
    jobs: data ?? [],
    retentionDays,
  })
}

/**
 * Startet einen Hintergrund-Export. Antwort sofort mit jobId; Verarbeitung per after() (+ Cron-Fallback).
 */
export async function POST() {
  const gate = await requireExportAccess()
  if (!gate.ok) return gate.response

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  const { data: active, error: activeErr } = await supabase
    .from('data_export_jobs')
    .select('id')
    .eq('user_id', user.id)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (activeErr) {
    return NextResponse.json({ error: 'Export-Status konnte nicht geprüft werden.' }, { status: 500 })
  }

  if (active?.id) {
    return NextResponse.json({ jobId: active.id as string, resumed: true })
  }

  const reuseAfter = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const { data: recentComplete, error: recentErr } = await supabase
    .from('data_export_jobs')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'complete')
    .not('storage_object_path', 'is', null)
    .gte('completed_at', reuseAfter)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!recentErr && recentComplete?.id) {
    return NextResponse.json({ jobId: recentComplete.id as string, resumed: true, reuseComplete: true })
  }

  const { data: inserted, error: insErr } = await supabase
    .from('data_export_jobs')
    .insert({
      user_id: user.id,
      status: 'pending',
      progress_percent: 0,
      progress_label: 'In Warteschlange …',
    })
    .select('id')
    .single()

  if (insErr || !inserted?.id) {
    return NextResponse.json({ error: insErr?.message ?? 'Export konnte nicht gestartet werden.' }, { status: 500 })
  }

  const jobId = inserted.id as string

  after(() => {
    void processDataExportJob(jobId)
  })

  return NextResponse.json({ jobId, resumed: false })
}
