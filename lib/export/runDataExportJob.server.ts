import 'server-only'

import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { buildUserDataExportZip } from '@/lib/export/buildUserExportZip'
import { uploadExportZipAndSign } from '@/lib/export/uploadExportZip'
import { sendExportReadyEmailAndMark } from '@/lib/export/sendExportReadyEmail.server'

const STALE_PROCESSING_MS = 25 * 60 * 1000
const PROGRESS_WRITE_MS = 2800

/**
 * Setzt hängengebliebene Jobs zurück (Worker abgestürzt / Timeout), damit der Cron sie erneut anstößt.
 */
export async function resetStaleDataExportJobs(): Promise<number> {
  const admin = createSupabaseServiceRoleClient()
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS).toISOString()
  const { data, error } = await admin
    .from('data_export_jobs')
    .update({
      status: 'pending',
      progress_label: 'Wird erneut gestartet …',
      updated_at: new Date().toISOString(),
    })
    .eq('status', 'processing')
    .lt('updated_at', cutoff)
    .select('id')

  if (error) {
    console.error('[data-export] reset stale jobs:', error.message)
    return 0
  }
  return data?.length ?? 0
}

/**
 * Verarbeitet einen Export-Job (nur wenn Status noch `pending` — verhindert Doppelarbeit).
 */
export async function processDataExportJob(jobId: string): Promise<void> {
  const admin = createSupabaseServiceRoleClient()
  const isoNow = () => new Date().toISOString()

  const { data: claimed, error: claimErr } = await admin
    .from('data_export_jobs')
    .update({
      status: 'processing',
      progress_percent: 0,
      progress_label: 'Export wird gestartet …',
      updated_at: isoNow(),
    })
    .eq('id', jobId)
    .eq('status', 'pending')
    .select('user_id')
    .maybeSingle()

  if (claimErr || !claimed?.user_id) {
    return
  }

  const userId = claimed.user_id as string
  let lastWrite = 0

  const reportProgress = (p: { percent: number; label: string }) => {
    const t = Date.now()
    if (t - lastWrite < PROGRESS_WRITE_MS && p.percent < 98) return
    lastWrite = t
    void admin
      .from('data_export_jobs')
      .update({
        progress_percent: Math.min(100, Math.max(0, p.percent)),
        progress_label: p.label,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
  }

  try {
    const buf = await buildUserDataExportZip(userId, {
      supabaseClient: admin,
      onProgress: reportProgress,
    })
    reportProgress({ percent: 94, label: 'Upload für sicheren Download …' })
    const { bucket, objectPath } = await uploadExportZipAndSign({ admin, userId, buf })

    const completedAtIso = new Date().toISOString()
    await admin
      .from('data_export_jobs')
      .update({
        status: 'complete',
        progress_percent: 100,
        progress_label: 'Export ist bereit.',
        storage_bucket: bucket,
        storage_object_path: objectPath,
        completed_at: completedAtIso,
        updated_at: completedAtIso,
        error_message: null,
      })
      .eq('id', jobId)

    await sendExportReadyEmailAndMark(admin, {
      jobId,
      userId,
      storageBucket: bucket,
      storageObjectPath: objectPath,
      completedAtIso,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Export fehlgeschlagen.'
    await admin
      .from('data_export_jobs')
      .update({
        status: 'failed',
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
  }
}

/**
 * Cron: einen ältesten pending-Job ausführen.
 */
export async function processOldestPendingDataExportJob(): Promise<{ ran: boolean; jobId: string | null }> {
  const admin = createSupabaseServiceRoleClient()
  const { data: row, error } = await admin
    .from('data_export_jobs')
    .select('id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !row?.id) {
    return { ran: false, jobId: null }
  }

  await processDataExportJob(row.id as string)
  return { ran: true, jobId: row.id as string }
}
