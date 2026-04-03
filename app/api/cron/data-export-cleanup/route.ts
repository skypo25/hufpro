import { NextResponse } from 'next/server'
import { cleanupExpiredDataExports } from '@/lib/export/cleanupExpiredDataExports.server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Täglicher Aufruf (Vercel Cron): löscht fertige Export-ZIPs nach DATA_EXPORT_RETENTION_DAYS (Standard 14).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? process.env.APPOINTMENT_REMINDER_CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const out = await cleanupExpiredDataExports()
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
