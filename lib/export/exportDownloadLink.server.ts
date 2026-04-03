import 'server-only'

import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Geheimer Schlüssel für Download-Links in Export-Mails (nur deine Domain in der URL, kein Supabase-Host).
 * In Produktion setzen: z. B. `openssl rand -hex 32`
 * Env: DATA_EXPORT_DOWNLOAD_SECRET
 */
export function getExportDownloadLinkSecret(): string | null {
  const s = process.env.DATA_EXPORT_DOWNLOAD_SECRET?.trim()
  return s && s.length >= 16 ? s : null
}

function signPayload(jobId: string, userId: string, expUnix: number, secret: string): string {
  const payload = `${jobId}|${userId}|${expUnix}`
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function buildExportEmailDownloadUrl(args: {
  appBase: string
  jobId: string
  userId: string
  expiresAtUnix: number
}): string | null {
  const secret = getExportDownloadLinkSecret()
  if (!secret) return null
  const sig = signPayload(args.jobId, args.userId, args.expiresAtUnix, secret)
  const q = new URLSearchParams({
    j: args.jobId,
    u: args.userId,
    e: String(args.expiresAtUnix),
    s: sig,
  })
  const base = args.appBase.replace(/\/+$/, '')
  return `${base}/api/export/email-download?${q.toString()}`
}

export function verifyExportEmailDownloadQuery(args: {
  jobId: string
  userId: string
  expUnix: number
  signature: string
}): boolean {
  const secret = getExportDownloadLinkSecret()
  if (!secret) return false
  if (!Number.isFinite(args.expUnix) || args.expUnix <= 0) return false
  const now = Math.floor(Date.now() / 1000)
  if (now > args.expUnix) return false
  const expected = signPayload(args.jobId, args.userId, args.expUnix, secret)
  try {
    const a = Buffer.from(args.signature, 'utf8')
    const b = Buffer.from(expected, 'utf8')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
