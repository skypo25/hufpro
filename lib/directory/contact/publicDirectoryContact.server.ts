import 'server-only'

import { createHash } from 'crypto'

import { sendMail, type SmtpConfig } from '@/lib/email'
import { buildDirectoryContactOwnerEmailHtml } from '@/lib/directory/contact/directoryContactInquiryOwnerEmailHtml'
import { directoryProfileHasActiveTop } from '@/lib/directory/premium/directoryProfileTopActive.server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { fetchSystemSmtp, type SystemSmtpRow } from '@/lib/systemSmtp'

const RATE_WINDOW_HOURS = 1
const MAX_PER_IP_PER_WINDOW = 8
const MAX_PER_PROFILE_PER_WINDOW = 15

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

function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
}

function ipSalt(): string {
  return (
    process.env.DIRECTORY_CONTACT_IP_SALT?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().slice(0, 24) ||
    'anidocs-directory-contact'
  )
}

export function hashDirectoryContactClientIp(ip: string): string {
  const raw = `${ip}\n${ipSalt()}`
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}

export function clientIpFromRequestHeaders(h: Headers): string {
  const xff = h.get('x-forwarded-for')?.trim()
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first.slice(0, 80)
  }
  const real = h.get('x-real-ip')?.trim()
  if (real) return real.slice(0, 80)
  return 'unknown'
}

export type PublicDirectoryContactBody = {
  slug?: unknown
  name?: unknown
  email?: unknown
  phone?: unknown
  message?: unknown
  privacyAccepted?: unknown
  /** Honeypot — muss leer bleiben. */
  website?: unknown
}

export type PublicDirectoryContactResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

export async function handlePublicDirectoryContactPost(
  body: PublicDirectoryContactBody,
  headers: Headers
): Promise<PublicDirectoryContactResult> {
  const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const privacyAccepted = body.privacyAccepted === true
  const honeypot = typeof body.website === 'string' ? body.website.trim() : ''

  if (honeypot.length > 0) {
    return { ok: false, status: 400, error: 'Anfrage konnte nicht gesendet werden.' }
  }
  if (!slug) {
    return { ok: false, status: 400, error: 'Profil fehlt.' }
  }
  if (name.length < 2 || name.length > 120) {
    return {
      ok: false,
      status: 400,
      error: 'Bitte Vor- und Nachname angeben (2–120 Zeichen).',
    }
  }
  if (!looksLikeEmail(email) || email.length > 254) {
    return { ok: false, status: 400, error: 'Bitte eine gültige E-Mail angeben.' }
  }
  if (phone.length < 4 || phone.length > 40) {
    return {
      ok: false,
      status: 400,
      error: 'Bitte eine gültige Telefonnummer angeben (4–40 Zeichen).',
    }
  }
  if (message.length < 1 || message.length > 4000) {
    return { ok: false, status: 400, error: 'Bitte eine Nachricht eingeben (max. 4000 Zeichen).' }
  }
  if (!privacyAccepted) {
    return { ok: false, status: 400, error: 'Bitte den Hinweis zur Datenverarbeitung bestätigen.' }
  }

  let admin: ReturnType<typeof createSupabaseServiceRoleClient>
  try {
    admin = createSupabaseServiceRoleClient()
  } catch {
    return { ok: false, status: 500, error: 'Server-Konfiguration unvollständig.' }
  }

  const ip = clientIpFromRequestHeaders(headers)
  const ipHash = hashDirectoryContactClientIp(ip)
  const ua = (headers.get('user-agent') ?? '').trim().slice(0, 200)

  const sinceIso = new Date(Date.now() - RATE_WINDOW_HOURS * 3600000).toISOString()

  const { count: ipCount, error: ipErr } = await admin
    .from('directory_contact_inquiries')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', sinceIso)

  if (ipErr) {
    return { ok: false, status: 500, error: 'Anfrage konnte nicht verarbeitet werden.' }
  }
  if ((ipCount ?? 0) >= MAX_PER_IP_PER_WINDOW) {
    return { ok: false, status: 429, error: 'Zu viele Anfragen. Bitte später erneut versuchen.' }
  }

  const { data: prof, error: profErr } = await admin
    .from('directory_profiles')
    .select('id, slug, display_name, listing_status, email_public')
    .eq('slug', slug)
    .maybeSingle()

  if (profErr || !prof) {
    return { ok: false, status: 404, error: 'Profil nicht gefunden.' }
  }

  const row = prof as {
    id: string
    slug: string
    display_name: string
    listing_status: string
    email_public: string | null
  }

  if (row.listing_status !== 'published') {
    return { ok: false, status: 404, error: 'Profil nicht gefunden.' }
  }

  const topOk = await directoryProfileHasActiveTop(admin, row.id)
  const ownerEmail = (row.email_public ?? '').trim()
  if (!topOk || !ownerEmail || !looksLikeEmail(ownerEmail)) {
    return { ok: false, status: 403, error: 'Kontaktformular für dieses Profil nicht verfügbar.' }
  }

  const { count: profCount, error: profCtErr } = await admin
    .from('directory_contact_inquiries')
    .select('id', { count: 'exact', head: true })
    .eq('directory_profile_id', row.id)
    .gte('created_at', sinceIso)

  if (profCtErr) {
    return { ok: false, status: 500, error: 'Anfrage konnte nicht verarbeitet werden.' }
  }
  if ((profCount ?? 0) >= MAX_PER_PROFILE_PER_WINDOW) {
    return { ok: false, status: 429, error: 'Zu viele Anfragen an dieses Profil. Bitte später erneut versuchen.' }
  }

  const smtpRow = await fetchSystemSmtp()
  const smtp = smtpRow ? smtpRowToConfig(smtpRow) : null
  if (!smtp) {
    return { ok: false, status: 503, error: 'E-Mail-Versand ist momentan nicht konfiguriert.' }
  }

  const display = (row.display_name ?? '').trim() || row.slug
  const subject = `AniDocs Verzeichnis: Neue Anfrage zu „${display}“`

  const text = [
    `Es ist eine neue Kontaktanfrage über das öffentliche Verzeichnisprofil eingegangen.`,
    ``,
    `Profil: ${display} (${row.slug})`,
    ``,
    `Vor- und Nachname: ${name}`,
    `E-Mail: ${email}`,
    `Telefon: ${phone}`,
    ``,
    `Nachricht:`,
    message,
    ``,
    `—`,
    `Antworten Sie direkt an die Absenderadresse (Reply-To).`,
  ].join('\n')

  const html = buildDirectoryContactOwnerEmailHtml({
    ownerDisplayName: display,
    profileSlug: row.slug,
    contactName: name,
    contactEmail: email,
    contactPhone: phone,
    contactMessage: message,
  })

  try {
    await sendMail(smtp, {
      to: ownerEmail,
      replyTo: email,
      subject,
      text,
      html,
    })
  } catch {
    return { ok: false, status: 503, error: 'E-Mail konnte nicht versendet werden. Bitte später erneut versuchen.' }
  }

  const { error: insErr } = await admin.from('directory_contact_inquiries').insert({
    directory_profile_id: row.id,
    sender_name: name,
    sender_email: email,
    sender_phone: phone,
    message,
    ip_hash: ipHash,
    user_agent_snip: ua.length ? ua : null,
    mail_sent: true,
  })

  if (insErr) {
    console.warn('[directory-contact] Mail gesendet, DB-Log fehlgeschlagen:', insErr.message)
  }

  return { ok: true }
}
