import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Row = {
  id: string
  user_id: string
  status: string
  progress_percent: number
  progress_label: string
  error_message: string | null
  storage_bucket: string | null
  storage_object_path: string | null
  completed_at: string | null
}

/**
 * Polling: Status + bei Erfolg frisch signierte Download-URL (Kurzlebigkeit wie bisher).
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Ungültige Job-ID.' }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  const { data: job, error } = await supabase.from('data_export_jobs').select('*').eq('id', id).maybeSingle()

  if (error || !job) {
    return NextResponse.json({ error: 'Export nicht gefunden.' }, { status: 404 })
  }

  const row = job as Row
  if (row.user_id !== user.id) {
    return NextResponse.json({ error: 'Export nicht gefunden.' }, { status: 404 })
  }

  const base = {
    status: row.status,
    progress_percent: row.progress_percent,
    progress_label: row.progress_label,
    error_message: row.error_message,
    downloadUrl: null as string | null,
    filename: null as string | null,
  }

  if (row.status !== 'complete' || !row.storage_bucket || !row.storage_object_path) {
    return NextResponse.json(base)
  }

  const admin = createSupabaseServiceRoleClient()
  const { data: signed, error: signErr } = await admin.storage
    .from(row.storage_bucket)
    .createSignedUrl(row.storage_object_path, 600)

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({
      ...base,
      error_message: signErr?.message ?? 'Download-Link konnte nicht erstellt werden.',
    })
  }

  const day = (row.completed_at ?? new Date().toISOString()).slice(0, 10)

  return NextResponse.json({
    ...base,
    downloadUrl: signed.signedUrl,
    filename: `anidocs-export-${day}.zip`,
  })
}
