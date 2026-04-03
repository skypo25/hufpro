import { NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { verifyExportEmailDownloadQuery } from '@/lib/export/exportDownloadLink.server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Öffentlicher Download aus der Export-Mail: nur App-Domain in der URL, Datei wird serverseitig aus Storage geladen.
 * Parameter j, u, e, s müssen zur DATA_EXPORT_DOWNLOAD_SECRET-Signatur passen.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('j')?.trim() ?? ''
  const userId = searchParams.get('u')?.trim() ?? ''
  const expRaw = searchParams.get('e')?.trim() ?? ''
  const signature = searchParams.get('s')?.trim() ?? ''

  const expUnix = Number(expRaw)
  if (!jobId || !userId || !signature || !Number.isFinite(expUnix)) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  if (!verifyExportEmailDownloadQuery({ jobId, userId, expUnix, signature })) {
    return NextResponse.json({ error: 'Link ungültig oder abgelaufen.' }, { status: 403 })
  }

  const admin = createSupabaseServiceRoleClient()
  const { data: job, error: jobErr } = await admin
    .from('data_export_jobs')
    .select('user_id, status, storage_bucket, storage_object_path, completed_at')
    .eq('id', jobId)
    .maybeSingle()

  if (jobErr || !job) {
    return NextResponse.json({ error: 'Export nicht gefunden.' }, { status: 404 })
  }

  const row = job as {
    user_id: string
    status: string
    storage_bucket: string | null
    storage_object_path: string | null
    completed_at: string | null
  }

  if (row.user_id !== userId) {
    return NextResponse.json({ error: 'Export nicht gefunden.' }, { status: 404 })
  }

  if (row.status !== 'complete' || !row.storage_bucket || !row.storage_object_path) {
    return NextResponse.json({ error: 'Export nicht mehr verfügbar.' }, { status: 410 })
  }

  const { data: file, error: dlErr } = await admin.storage
    .from(row.storage_bucket)
    .download(row.storage_object_path)

  if (dlErr || !file) {
    return NextResponse.json({ error: 'Datei konnte nicht geladen werden.' }, { status: 404 })
  }

  const day = (row.completed_at ?? new Date().toISOString()).slice(0, 10)
  const filename = `anidocs-export-${day}.zip`
  const ab = await file.arrayBuffer()

  return new NextResponse(ab, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
