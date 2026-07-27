import { NextResponse } from 'next/server'
import { requireAppAccess } from '@/lib/billing/requireAppAccess'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/** Allowlist für Einstellungs-Keys – nur diese werden akzeptiert (Sicherheitshärtung). */
const ALLOWED_SETTINGS_KEYS = new Set([
  'salutation', 'firstName', 'lastName', 'qualification', 'phone', 'email', 'website', 'socialMedia',
  'companyName', 'legalForm', 'street', 'city', 'zip', 'country',
  'taxNumber', 'taxOffice', 'kleinunternehmer', 'kleinunternehmerText', 'ustId', 'defaultTaxRate',
  'accountHolder', 'bank', 'iban', 'bic', 'paypal', 'paymentTerms',
  'customerNumberPrefix', 'nextCustomerNumber',
  'invoicePrefix', 'nextInvoiceNumber', 'currency', 'invoiceDelivery', 'invoiceTextTop', 'invoiceTextBottom',
  'services', 'logoUrl',
  'smtpHost', 'smtpPort', 'smtpSecure', 'smtpUser', 'smtpPassword', 'smtpFromEmail', 'smtpFromName',
  'preferredNavApp', 'emailReminders', 'appointmentReminderDefaultMinutes', 'pushNotifications', 'dailySummary',
  'onboarding_complete',
])

export async function POST(request: Request) {
  const gate = await requireAppAccess({ mode: 'write' })
  if (!gate.ok) return gate.response

  const supabase = await createSupabaseServerClient()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const raw = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  const patch: Record<string, unknown> = {}
  for (const key of Object.keys(raw)) {
    if (ALLOWED_SETTINGS_KEYS.has(key)) patch[key] = raw[key]
  }

  const { data: existing } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', gate.userId)
    .maybeSingle()

  const existingSettings = (existing?.settings ?? {}) as Record<string, unknown>
  const merged: Record<string, unknown> = { ...existingSettings, ...patch }

  if (patch.smtpPassword === '' || patch.smtpPassword === undefined) {
    if (existingSettings.smtpPassword) merged.smtpPassword = existingSettings.smtpPassword
    else delete merged.smtpPassword
  }

  const { error } = await supabase
    .from('user_settings')
    .upsert(
      { user_id: gate.userId, settings: merged, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )

  if (error) {
    const isMissingTable = /relation.*does not exist|Could not find the/.test(error.message)
    const message = isMissingTable
      ? 'Die Tabelle "user_settings" fehlt in der Datenbank. Bitte im Supabase-Dashboard unter SQL Editor die Migration ausführen (Datei: supabase/migrations/20250313000000_user_settings.sql).'
      : error.message
    return NextResponse.json({ error: message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
