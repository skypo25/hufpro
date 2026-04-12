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

async function resolveUserEmail(db: SupabaseClient, userId: string): Promise<string | null> {
  try {
    const { data, error } = await db.auth.admin.getUserById(userId)
    if (!error) {
      const authEmail = (data.user?.email ?? '').trim()
      if (authEmail) return authEmail
    }
  } catch {
    // ignore
  }
  return null
}

export type DirectoryProductEmailKind =
  | 'free_profile_created'
  | 'profile_saved_checkout_next'
  | 'directory_premium_checkout_done'
  | 'app_checkout_done'

type Args = {
  db: SupabaseClient
  userId: string
  profileSlug: string
  displayName?: string | null
  kind: DirectoryProductEmailKind
}

/**
 * Transaktionale Verzeichnis-/Produkt-Mails (System-SMTP). Fehler werden geloggt, kein Throw.
 */
export async function sendDirectoryProductEmail(args: Args): Promise<void> {
  const smtpRow = await fetchSystemSmtp()
  const smtp = smtpRow ? smtpRowToConfig(smtpRow) : null
  if (!smtp) {
    console.warn('[directory-product-email] Kein System-SMTP — keine Mail.')
    return
  }

  const to = await resolveUserEmail(args.db, args.userId)
  if (!to) {
    console.warn('[directory-product-email] Keine Auth-E-Mail für', args.userId)
    return
  }

  const appBase = getExportAppBaseUrl()
  const meinProfil = `${appBase}/directory/mein-profil`
  const publicProfil = `${appBase}/behandler/${encodeURIComponent(args.profileSlug)}`
  const billing = `${appBase}/billing`
  const name = (args.displayName ?? '').trim() || args.profileSlug

  let subject: string
  let text: string
  let html: string

  switch (args.kind) {
    case 'free_profile_created':
      subject = 'AniDocs: Dein Gratis-Verzeichnisprofil wurde angelegt'
      text = [
        `Hallo,`,
        ``,
        `dein Gratis-Verzeichnisprofil „${name}“ wurde als Entwurf gespeichert.`,
        ``,
        `Bearbeiten: ${meinProfil}`,
        `Öffentliche Vorschau (wenn veröffentlicht): ${publicProfil}`,
        ``,
        `Mit dem Premium-Verzeichnisprofil (9,95 €/Monat) schaltest du Galerie und Kontaktformular frei.`,
        ``,
        `Viele Grüße`,
        `AniDocs`,
      ].join('\n')
      html = `<p>Hallo,</p><p>dein Gratis-Verzeichnisprofil <strong>${escapeHtml(name)}</strong> wurde als Entwurf gespeichert.</p><p><a href="${meinProfil}">Profil bearbeiten (Mein Profil)</a><br/><a href="${publicProfil}">Öffentliche Ansicht</a></p><p>Mit dem <strong>Premium-Verzeichnisprofil (9,95 €/Monat)</strong> schaltest du Galerie und Kontaktformular frei.</p>`
      break
    case 'profile_saved_checkout_next':
      subject = 'AniDocs: Profil gespeichert — letzter Schritt: Zahlung'
      text = [
        `Hallo,`,
        ``,
        `dein Verzeichnisprofil „${name}“ wurde gespeichert.`,
        `Bitte schließe die Zahlung im geöffneten Stripe-Fenster ab, damit Premium-Funktionen oder die App freigeschaltet werden.`,
        ``,
        `Mein Profil: ${meinProfil}`,
        ``,
        `Viele Grüße`,
        `AniDocs`,
      ].join('\n')
      html = `<p>Hallo,</p><p>dein Verzeichnisprofil <strong>${escapeHtml(name)}</strong> wurde gespeichert. Bitte schließe die Zahlung ab, damit die gewählten Leistungen aktiv werden.</p><p><a href="${meinProfil}">Mein Profil</a></p>`
      break
    case 'directory_premium_checkout_done':
      subject = 'AniDocs: Premium-Verzeichnisprofil aktiv'
      text = [
        `Hallo,`,
        ``,
        `dein Premium-Verzeichnisprofil „${name}“ ist aktiv: Galerie und Kontaktformular sind freigeschaltet.`,
        ``,
        `Bearbeiten: ${meinProfil}`,
        ``,
        `Viele Grüße`,
        `AniDocs`,
      ].join('\n')
      html = `<p>Hallo,</p><p>dein <strong>Premium-Verzeichnisprofil</strong> <strong>${escapeHtml(name)}</strong> ist aktiv (Galerie und Kontaktformular).</p><p><a href="${meinProfil}">Profil bearbeiten</a></p>`
      break
    case 'app_checkout_done':
      subject = 'AniDocs: App-Zugang aktiv — Premium-Verzeichnis inklusive'
      text = [
        `Hallo,`,
        ``,
        `dein AniDocs-App-Abo ist aktiv. Das Premium-Verzeichnisprofil ist darin enthalten — kein separates Verzeichnis-Premium nötig.`,
        ``,
        `App & Kundenbereich: ${billing}`,
        `Verzeichnisprofil bearbeiten: ${meinProfil}`,
        ``,
        `Viele Grüße`,
        `AniDocs`,
      ].join('\n')
      html = `<p>Hallo,</p><p>dein <strong>AniDocs-App-Abo</strong> ist aktiv. Das <strong>Premium-Verzeichnisprofil</strong> ist inklusive.</p><p><a href="${billing}">Zur App / Kundenbereich</a><br/><a href="${meinProfil}">Mein Verzeichnisprofil</a></p>`
      break
    default:
      return
  }

  try {
    await sendMail(smtp, { to, subject, text, html })
  } catch (e) {
    console.warn('[directory-product-email] Versand fehlgeschlagen', e)
  }
}
