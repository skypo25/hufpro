'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export type InvoiceItemInput = {
  description: string
  quantity: number
  unitPriceCents: number
  amountCents: number
}

export async function updateInvoice(
  invoiceId: string,
  customerId: string,
  payload: {
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
    status?: 'draft' | 'sent' | 'paid' | 'cancelled'
  }
): Promise<{ invoiceId: string } | { error: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: existing } = await supabase
    .from('invoices')
    .select('id, status')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single()

  if (!existing || existing.status !== 'draft') {
    return { error: 'Rechnung kann nur im Entwurf bearbeitet werden.' }
  }

  const updateData: Record<string, unknown> = {
    invoice_date: payload.invoice_date,
    service_date_from: payload.service_date_from ?? null,
    payment_due_date: payload.payment_due_date,
    intro_text: payload.intro_text,
    footer_text: payload.footer_text,
    buyer_name: payload.buyer_name,
    buyer_company: payload.buyer_company,
    buyer_street: payload.buyer_street,
    buyer_zip: payload.buyer_zip,
    buyer_city: payload.buyer_city,
    buyer_country: payload.buyer_country,
    updated_at: new Date().toISOString(),
  }
  if (payload.status !== undefined) {
    updateData.status = payload.status
  }

  const { error: updErr } = await supabase
    .from('invoices')
    .update(updateData)
    .eq('id', invoiceId)
    .eq('user_id', user.id)

  if (updErr) {
    return { error: updErr.message }
  }

  await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId)

  for (let i = 0; i < payload.items.length; i++) {
    const it = payload.items[i]
    const { error: itemErr } = await supabase.from('invoice_items').insert({
      invoice_id: invoiceId,
      position: i + 1,
      description: it.description,
      quantity: it.quantity,
      unit_price_cents: it.unitPriceCents,
      amount_cents: it.amountCents,
      tax_rate_percent: 0,
    })
    if (itemErr) {
      return { error: itemErr.message }
    }
  }

  revalidatePath('/invoices')
  revalidatePath(`/invoices/${invoiceId}`)
  revalidatePath(`/customers/${customerId}/invoices`)
  return { invoiceId }
}
