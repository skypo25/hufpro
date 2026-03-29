'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase-server'

function priceStringToCents(s: string): number {
  const cleaned = String(s).replace(/[^\d,.-]/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  if (Number.isNaN(num)) return 0
  return Math.round(num * 100)
}

export type InvoiceItemInput = {
  description: string
  quantity: number
  unitPriceCents: number
  amountCents: number
}

export async function createInvoice(
  customerId: string,
  payload: {
    invoice_number: string
    invoice_date: string
    service_date_from?: string | null
    payment_due_date: string
    intro_text: string | null
    footer_text: string | null
    buyer_name: string
    buyer_company: string | null
    buyer_street: string | null
    buyer_zip: string | null
    buyer_city: string | null
    buyer_country: string | null
    items: InvoiceItemInput[]
    /** Standard: Entwurf; „senden“ = sofort als versendet/offen (Detailansicht) */
    status?: 'draft' | 'sent'
  }
): Promise<{ invoiceId: string } | { error: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name, first_name, last_name, company, street, postal_code, city, country')
    .eq('id', customerId)
    .eq('user_id', user.id)
    .single()

  if (!customer) {
    return { error: 'Kunde nicht gefunden.' }
  }

  // Nächste freie Rechnungsnummer ermitteln (vermeidet duplicate key bei Seed/Doppelklick)
  const match = payload.invoice_number.match(/^(.+?-)(\d{4})-(\d+)$/)
  const prefix = match ? match[1] : 'HUF-'
  const year = match ? match[2] : new Date().getFullYear().toString()
  const pattern = `${prefix}${year}-%`
  const { data: existing } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('user_id', user.id)
    .ilike('invoice_number', pattern)
  let nextSeq = 1
  if (existing?.length) {
    const seqs = existing
      .map((r) => {
        const m = r.invoice_number.match(/-(\d+)$/)
        return m ? parseInt(m[1], 10) : 0
      })
      .filter((n) => !Number.isNaN(n))
    if (seqs.length) nextSeq = Math.max(...seqs) + 1
  }
  const invoiceNumber = `${prefix}${year}-${String(nextSeq).padStart(4, '0')}`
  const finalStatus = payload.status === 'sent' ? 'sent' : 'draft'
  const nowIso = new Date().toISOString()

  const { data: inv, error: invErr } = await supabase
    .from('invoices')
    .insert({
      user_id: user.id,
      customer_id: customer.id,
      invoice_number: invoiceNumber,
      invoice_date: payload.invoice_date,
      service_date_from: payload.service_date_from ?? null,
      payment_due_date: payload.payment_due_date,
      status: finalStatus,
      ...(finalStatus === 'sent' ? { sent_at: nowIso } : {}),
      intro_text: payload.intro_text,
      footer_text: payload.footer_text,
      buyer_name: payload.buyer_name,
      buyer_company: payload.buyer_company,
      buyer_street: payload.buyer_street,
      buyer_zip: payload.buyer_zip,
      buyer_city: payload.buyer_city,
      buyer_country: payload.buyer_country,
    })
    .select('id')
    .single()

  if (invErr || !inv) {
    return { error: invErr?.message ?? 'Rechnung konnte nicht erstellt werden.' }
  }

  for (let i = 0; i < payload.items.length; i++) {
    const it = payload.items[i]
    const { error: itemErr } = await supabase.from('invoice_items').insert({
      invoice_id: inv.id,
      position: i + 1,
      description: it.description,
      quantity: it.quantity,
      unit_price_cents: it.unitPriceCents,
      amount_cents: it.amountCents,
      tax_rate_percent: 0,
    })
    if (itemErr) {
      await supabase.from('invoices').delete().eq('id', inv.id)
      return { error: itemErr.message }
    }
  }

  const { data: settingsRow } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle<{ settings: Record<string, unknown> | null }>()
  const s = (settingsRow?.settings ?? {}) as Record<string, unknown>
  const nextNumber = `${year}-${String(nextSeq + 1).padStart(4, '0')}`
  await supabase
    .from('user_settings')
    .upsert(
      { user_id: user.id, settings: { ...s, nextInvoiceNumber: nextNumber } },
      { onConflict: 'user_id' }
    )

  revalidatePath('/invoices')
  revalidatePath('/dashboard')
  revalidatePath(`/customers/${customerId}/invoices`)
  return { invoiceId: inv.id }
}
