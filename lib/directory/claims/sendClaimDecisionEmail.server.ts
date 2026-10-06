import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { sendMail, type SmtpConfig } from '@/lib/email'
import { getExportAppBaseUrl } from '@/lib/export/exportAppBaseUrl'
import { fetchSystemSmtp, type SystemSmtpRow } from '@/lib/systemSmtp'

function smtpRowToConfig(row: SystemSmtpRow): SmtpConfig | null {
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

async function resolveClaimantToEmail(
  db: SupabaseClient,
  claimantUserId: string,
  snapshotEmail: string
): Promise<string | null> {
  const snap = snapshotEmail.trim()
  try {
    const { data, error } = await db.auth.admin.getUserById(claimantUserId)
    if (!error) {
      const authEmail = (data.user?.email ?? '').trim()
      if (authEmail) return authEmail
    }
  } catch {
    // ignore
  }
  return snap || null
}

export type ClaimDecisionEmailArgs = {
  kind: 'approved' | 'rejected'
  db: SupabaseClient
  claimantUserId: string
  claimantEmailSnapshot: string
  profileDisplayName: string
  profileSlug: string
  rejectionReason?: string | null
}

/**
 * System-SMTP (Admin → System). Scheitert still (nur console), Admin-Flow bleibt erfolgreich.
 */
export async function sendDirectoryClaimDecisionEmail(args: ClaimDecisionEmailArgs): Promise<void> {
  const smtpRow = await fetchSystemSmtp()
  const smtp = smtpRow ? smtpRowToConfig(smtpRow) : null
  if (!smtp) {
    console.warn('[directory-claim] Kein System-SMTP — keine Entscheidungs-Mail an Antragsteller.')
    return
  }

  const to = await resolveClaimantToEmail(args.db, args.claimantUserId, args.claimantEmailSnapshot)
  if (!to) {
    console.warn('[directory-claim] Keine Ziel-E-Mail für Claim-Benachrichtigung (Auth + Snapshot leer).')
    return
  }

  const appBase = getExportAppBaseUrl()
  const loginUrl = `${appBase}/login`
  const meinProfilUrl = `${appBase}/directory/mein-profil`
  const publicProfilUrl = `${appBase}/behandler/${encodeURIComponent(args.profileSlug)}`
  const name = args.profileDisplayName.trim() || args.profileSlug

  let subject: string
  let text: string
  let html: string

  if (args.kind === 'approved') {
    subject = 'AniDocs: Dein Profil-Antrag wurde angenommen'
    text = [
      `Hallo,`,
      ``,
      `Dein Antrag auf Übernahme des Verzeichniseintrags „${name}“ wurde angenommen.`,
      ``,
      `Melde dich in der AniDocs-App an: ${loginUrl}`,
      `Dein Verzeichnisprofil findest du unter: ${meinProfilUrl}`,
      `Öffentliche Ansicht: ${publicProfilUrl}`,
      ``,
      `Viele Grüße`,
      `Dein AniDocs-Team`,
    ].join('\n')
    html = `<p>Hallo,</p>
<p>Dein Antrag auf Übernahme des Verzeichniseintrags <strong>${escapeHtml(name)}</strong> wurde <strong>angenommen</strong>.</p>
<p><a href="${escapeHtml(loginUrl)}">Zur Anmeldung</a> · <a href="${escapeHtml(meinProfilUrl)}">Mein Verzeichnisprofil</a></p>
<p><small>Öffentliche Seite: <a href="${escapeHtml(publicProfilUrl)}">${escapeHtml(publicProfilUrl)}</a></small></p>
<p>Viele Grüße<br/>Dein AniDocs-Team</p>`
  } else {
    subject = 'AniDocs: Dein Profil-Antrag wurde abgelehnt'
    const reasonBlock =
      args.rejectionReason && args.rejectionReason.trim()
        ? `\n\nHinweis von AniDocs:\n${args.rejectionReason.trim()}`
        : ''
    const reasonHtml =
      args.rejectionReason && args.rejectionReason.trim()
        ? `<p><strong>Hinweis:</strong> ${escapeHtml(args.rejectionReason.trim())}</p>`
        : ''
    text = [
      `Hallo,`,
      ``,
      `Dein Antrag auf Übernahme des Verzeichniseintrags „${name}“ wurde leider abgelehnt.${reasonBlock}`,
      ``,
      `Bei Rückfragen wende dich bitte an den AniDocs-Support.`,
      ``,
      `Viele Grüße`,
      `Dein AniDocs-Team`,
    ].join('\n')
    html = `<p>Hallo,</p>
<p>Dein Antrag auf Übernahme des Verzeichniseintrags <strong>${escapeHtml(name)}</strong> wurde <strong>abgelehnt</strong>.</p>
${reasonHtml}
<p>Bei Rückfragen wende dich bitte an den AniDocs-Support.</p>
<p>Viele Grüße<br/>Dein AniDocs-Team</p>`
  }

  try {
    await sendMail(smtp, { to, subject, text, html })
  } catch (e) {
    console.warn('[directory-claim] Entscheidungs-Mail fehlgeschlagen:', e instanceof Error ? e.message : e)
  }
}
