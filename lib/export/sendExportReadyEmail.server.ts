import 'server-only'

import { readFileSync } from 'fs'
import { join } from 'path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendMail, type SmtpConfig } from '@/lib/email'
import { fetchSystemSmtp } from '@/lib/systemSmtp'
import { getExportAppBaseUrl } from '@/lib/export/exportAppBaseUrl'
import { resolveDataExportRetentionDays } from '@/lib/systemSettings.server'
import { buildExportEmailDownloadUrl, getExportDownloadLinkSecret } from '@/lib/export/exportDownloadLink.server'

function smtpRowToConfig(row: NonNullable<Awaited<ReturnType<typeof fetchSystemSmtp>>>): SmtpConfig | null {
  const host = (row.host ?? '').trim()
  const user = (row.smtp_user ?? '').trim()
  const password = (row.password ?? '').trim()
  if (!host || !user || !password) return null
  return {
    host,
    port: Number(row.port) || 587,
    secure: Boolean(row.secure),
    user,
    password,
    fromEmail: (row.from_email ?? '').trim() || undefined,
    fromName: (row.from_name ?? '').trim() || undefined,
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

let templateCache: string | null = null

function loadExportReadyEmailTemplate(): string {
  if (templateCache) return templateCache
  const path = join(process.cwd(), 'lib/export/exportReadyEmail.template.html')
  templateCache = readFileSync(path, 'utf8')
  return templateCache
}

function formatExpiryDateDe(completedAtIso: string, retentionDays: number): string {
  const start = new Date(completedAtIso)
  const endMs = start.getTime() + retentionDays * 86400000
  const end = new Date(endMs)
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(end)
}

function fillExportReadyTemplate(vars: {
  downloadUrl: string
  expiryDateDe: string
  retentionDays: number
  appBase: string
  year: number
}): string {
  const downloadUrlXml = vars.downloadUrl.replace(/&/g, '&amp;')
  const downloadUrlText = escapeHtml(vars.downloadUrl)
  return loadExportReadyEmailTemplate()
    .replace(/\{\{expiry_date\}\}/g, escapeHtml(vars.expiryDateDe))
    .replace(/\{\{retention_days\}\}/g, String(vars.retentionDays))
    .replace(/\{\{download_url_xml\}\}/g, downloadUrlXml)
    .replace(/\{\{download_url\}\}/g, vars.downloadUrl)
    .replace(/\{\{download_url_text\}\}/g, downloadUrlText)
    .replace(/\{\{app_base\}\}/g, vars.appBase)
    .replace(/\{\{year\}\}/g, String(vars.year))
}

const SIGNED_URL_MAX_SEC = 86400 * 365

/**
 * Versendet die Fertig-Mail (HTML-Vorlage + direkter Download per signierter URL).
 * Setzt bei Erfolg `email_notified_at` am Job.
 */
export async function sendExportReadyEmailAndMark(
  admin: SupabaseClient,
  args: {
    jobId: string
    userId: string
    storageBucket: string
    storageObjectPath: string
    completedAtIso: string
  }
): Promise<boolean> {
  const { jobId, userId, storageBucket, storageObjectPath, completedAtIso } = args

  const smtpRow = await fetchSystemSmtp()
  const smtp = smtpRow ? smtpRowToConfig(smtpRow) : null
  if (!smtp) {
    console.warn('[data-export] Kein System-SMTP — keine Export-Fertig-Mail.')
    return false
  }

  const { data: authData, error: authErr } = await admin.auth.admin.getUserById(userId)
  if (authErr || !authData?.user?.email?.trim()) {
    console.warn('[data-export] Keine E-Mail für Nutzer — keine Fertig-Mail.', authErr?.message)
    return false
  }

  const to = authData.user.email.trim()
  const retentionDays = await resolveDataExportRetentionDays()
  const ttlSec = Math.min(86400 * retentionDays, SIGNED_URL_MAX_SEC)

  const appBase = getExportAppBaseUrl()
  const settingsFallback = `${appBase}/settings#datenexport-downloads`
  const expiresAtUnix = Math.floor(Date.now() / 1000 + ttlSec)

  const appDownloadUrl = buildExportEmailDownloadUrl({
    appBase,
    jobId,
    userId,
    expiresAtUnix,
  })

  let downloadUrl = appDownloadUrl
  let usedSupabaseFallback = false

  if (!downloadUrl) {
    if (!getExportDownloadLinkSecret()) {
      console.warn(
        '[data-export] DATA_EXPORT_DOWNLOAD_SECRET fehlt — Mail nutzt signierte Storage-URL (sichtbarer Supabase-Host). Für Live: Secret setzen.'
      )
    }
    const { data: signed, error: signErr } = await admin.storage
      .from(storageBucket)
      .createSignedUrl(storageObjectPath, ttlSec)
    downloadUrl = signed?.signedUrl ?? settingsFallback
    usedSupabaseFallback = Boolean(signed?.signedUrl)
    if (signErr || !signed?.signedUrl) {
      console.warn('[data-export] Signierte URL fehlgeschlagen — Mail mit Einstellungs-Link.', signErr?.message)
    }
  }

  const expiryDateDe = formatExpiryDateDe(completedAtIso, retentionDays)
  const year = new Date().getFullYear()
  const subject = 'Dein Datenexport ist fertig – anidocs'

  const html = fillExportReadyTemplate({
    downloadUrl,
    expiryDateDe,
    retentionDays,
    appBase,
    year,
  })

  const text = [
    'Hallo,',
    '',
    'dein Datenexport ist fertig.',
    '',
    `Download (Link gültig wie konfiguriert, bis zu ${retentionDays} Tage):`,
    downloadUrl,
    '',
    `Voraussichtlich verfügbar bis: ${expiryDateDe}`,
    '',
    !appDownloadUrl && !usedSupabaseFallback
      ? 'Hinweis: Direktdownload war kurz nicht möglich — nutz den Link zu den Einstellungen unten.'
      : '',
    '',
    `Alternativ in der App: ${settingsFallback}`,
    '',
    `Die ZIP-Datei wird nach ${retentionDays} Tagen automatisch vom Server entfernt.`,
    '',
    'Viele Grüße',
    'Dein anidocs Team',
  ]
    .filter((line) => line !== '')
    .join('\n')

  try {
    await sendMail(smtp, { to, subject, text, html })
  } catch (e) {
    console.error('[data-export] Fertig-Mail fehlgeschlagen:', e instanceof Error ? e.message : e)
    return false
  }

  const { error: upErr } = await admin
    .from('data_export_jobs')
    .update({ email_notified_at: new Date().toISOString() })
    .eq('id', jobId)

  if (upErr) {
    console.error('[data-export] email_notified_at Update:', upErr.message)
  }

  return true
}
