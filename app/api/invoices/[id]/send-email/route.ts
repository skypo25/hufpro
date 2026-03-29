import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { sendMail } from '@/lib/email'
import { fetchInvoicePdfData } from '@/lib/pdf/invoiceData'
import InvoicePdfDocument from '@/components/pdf/InvoicePdfDocument'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SettingsSmtp = {
  smtpHost?: string
  smtpPort?: number
  smtpSecure?: boolean
  smtpUser?: string
  smtpPassword?: string
  smtpFromEmail?: string
  smtpFromName?: string
  email?: string
  firstName?: string
  lastName?: string
  companyName?: string
}

function fmtDeDate(d: string | null | undefined): string {
  if (!d) return '–'
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return d
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }

  const { id: invoiceId } = await params
  if (!invoiceId?.trim()) {
    return NextResponse.json({ error: 'invoiceId fehlt.' }, { status: 400 })
  }

  const { data: invRow, error: invErr } = await supabase
    .from('invoices')
    .select('id, customer_id, status, invoice_number, invoice_date, payment_due_date, sent_at')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single()

  if (invErr || !invRow) {
    return NextResponse.json({ error: 'Rechnung nicht gefunden.' }, { status: 404 })
  }

  if (invRow.status === 'cancelled') {
    return NextResponse.json({ error: 'Stornierte Rechnungen können nicht per E-Mail versendet werden.' }, { status: 400 })
  }

  const customerId = invRow.customer_id as string | null
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Kunde zugeordnet. Bitte Rechnungsempfänger prüfen.' }, { status: 400 })
  }

  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .select('id, name, first_name, last_name, email')
    .eq('id', customerId)
    .eq('user_id', user.id)
    .single()

  if (custErr || !customer) {
    return NextResponse.json({ error: 'Kunde nicht gefunden.' }, { status: 404 })
  }

  const toEmail = (customer.email ?? '').toString().trim()
  if (!toEmail) {
    return NextResponse.json(
      { error: 'Beim Kunden ist keine E-Mail-Adresse hinterlegt. Bitte beim Kunden eine E-Mail eintragen.' },
      { status: 400 }
    )
  }

  const { data: settingsRow } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle()

  const settings = (settingsRow?.settings ?? {}) as SettingsSmtp
  const host = (settings.smtpHost ?? '').toString().trim()
  const port = Number(settings.smtpPort) || 587
  const secure = Boolean(settings.smtpSecure)
  const smtpUser = (settings.smtpUser ?? '').toString().trim()
  const smtpPassword = (settings.smtpPassword ?? '').toString().trim()

  if (!host || !smtpUser || !smtpPassword) {
    return NextResponse.json(
      { error: 'SMTP-Einstellungen unvollständig. Bitte unter Einstellungen → Benachrichtigungen Host, Benutzer und Passwort eintragen.' },
      { status: 400 }
    )
  }

  const fromEmail =
    (settings.smtpFromEmail ?? '').toString().trim() ||
    (settings.email ?? '').toString().trim() ||
    (user.email ?? '').toString().trim() ||
    smtpUser
  const fromName =
    (settings.smtpFromName ?? '').toString().trim() ||
    [settings.firstName, settings.lastName].filter(Boolean).join(' ').trim() ||
    (settings.companyName ?? 'AniDocs').toString().trim()

  const pdfData = await fetchInvoicePdfData(supabase, user.id, invoiceId)
  if (!pdfData) {
    return NextResponse.json({ error: 'PDF-Daten konnten nicht geladen werden.' }, { status: 404 })
  }

  // PDF erzeugen (wie /invoices/[id]/pdf)
  const element = React.createElement(InvoicePdfDocument, { data: pdfData })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(element as any)

  const filename = `Rechnung-${pdfData.invoiceNumber}.pdf`
  const customerName =
    (customer.name ?? '').toString().trim() ||
    [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim() ||
    'Kunde/Kundin'

  const subject = `Rechnung ${pdfData.invoiceNumber}`
  const totalStr = formatCurrency(pdfData.totalCents)
  const dueStr = pdfData.paymentDueDate ? fmtDeDate(pdfData.paymentDueDate) : '–'
  const invDateStr = fmtDeDate(pdfData.invoiceDate)

  const text = [
    'Guten Tag,',
    '',
    `anbei erhalten Sie die Rechnung ${pdfData.invoiceNumber}.`,
    `Rechnungsdatum: ${invDateStr}`,
    pdfData.paymentDueDate ? `Zahlungsziel: ${dueStr}` : null,
    `Gesamtbetrag: ${totalStr}`,
    '',
    'Mit freundlichen Grüßen',
    fromName || 'AniDocs',
  ]
    .filter(Boolean)
    .join('\n')

  const html = [
    '<p>Guten Tag,</p>',
    `<p>anbei erhalten Sie die Rechnung <strong>${pdfData.invoiceNumber}</strong>.</p>`,
    '<ul>',
    `<li>Rechnungsdatum: ${invDateStr}</li>`,
    pdfData.paymentDueDate ? `<li>Zahlungsziel: ${dueStr}</li>` : '',
    `<li>Gesamtbetrag: ${totalStr}</li>`,
    '</ul>',
    `<p>Mit freundlichen Grüßen<br />${fromName || 'AniDocs'}</p>`,
  ]
    .filter(Boolean)
    .join('')

  try {
    const out = await sendMail(
      {
        host,
        port,
        secure,
        user: smtpUser,
        password: smtpPassword,
        fromEmail,
        fromName,
      },
      {
        to: toEmail,
        subject,
        text,
        html,
        attachments: [
          {
            filename,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      }
    )

    // Wenn der Status noch nicht "sent" ist: als versendet führen.
    const nowIso = new Date().toISOString()
    const patch: Record<string, unknown> = { updated_at: nowIso }
    if (invRow.status === 'draft') patch.status = 'sent'
    if (!invRow.sent_at) patch.sent_at = nowIso
    await supabase.from('invoices').update(patch).eq('id', invoiceId).eq('user_id', user.id)

    return NextResponse.json({
      ok: true,
      to: toEmail,
      subject,
      messageId: out.messageId ?? null,
      accepted: out.accepted ?? null,
      rejected: out.rejected ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'E-Mail-Versand fehlgeschlagen'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

