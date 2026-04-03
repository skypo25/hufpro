import { NextResponse } from 'next/server'
import {
  processOldestPendingDataExportJob,
  resetStaleDataExportJobs,
} from '@/lib/export/runDataExportJob.server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Geplanter Aufruf (z. B. Vercel Cron) mit Authorization: Bearer CRON_SECRET.
 * Räumt hängende processing-Jobs auf und startet einen pending-Export.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? process.env.APPOINTMENT_REMINDER_CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resetCount = await resetStaleDataExportJobs()
    const out = await processOldestPendingDataExportJob()
    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      staleJobsReset: resetCount,
      processedPending: out.ran,
      jobId: out.jobId,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
