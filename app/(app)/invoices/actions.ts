'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled'

export async function updateInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: row } = await supabase
    .from('invoices')
    .select('id, customer_id, status')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single()

  if (!row) {
    return { error: 'Rechnung nicht gefunden.' }
  }

  const currentStatus = row.status as InvoiceStatus
  if (currentStatus === 'draft' && (status === 'paid' || status === 'sent')) {
    return { error: 'Eine Rechnung mit Status Entwurf kann nicht als bezahlt oder offen markiert werden.' }
  }

  const { error } = await supabase
    .from('invoices')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/invoices')
  revalidatePath(`/invoices/${invoiceId}`)
  if (row.customer_id) {
    revalidatePath(`/customers/${row.customer_id}/invoices`)
  }
  return { ok: true }
}
