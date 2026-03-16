'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function getRevenueForMobile(): Promise<{
  monthlyCents: number[]
  totalCents: number
}> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const monthly = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

  if (!user?.id) return { monthlyCents: monthly, totalCents: 0 }

  const year = new Date().getFullYear()
  const { data: revenueInvoices } = await supabase
    .from('invoices')
    .select('id, invoice_date')
    .eq('user_id', user.id)
    .in('status', ['paid', 'sent'])
    .gte('invoice_date', `${year}-01-01`)
    .lt('invoice_date', `${year + 1}-01-01`)

  const ids = (revenueInvoices ?? []).map((r) => r.id)
  if (ids.length > 0) {
    const { data: items } = await supabase
      .from('invoice_items')
      .select('invoice_id, amount_cents')
      .in('invoice_id', ids)
    const sumByInvoice = new Map<string, number>()
    for (const row of items ?? []) {
      sumByInvoice.set(row.invoice_id, (sumByInvoice.get(row.invoice_id) ?? 0) + (row.amount_cents ?? 0))
    }
    for (const inv of revenueInvoices ?? []) {
      const month = new Date(inv.invoice_date).getMonth()
      monthly[month] = (monthly[month] ?? 0) + (sumByInvoice.get(inv.id) ?? 0)
    }
  }

  return {
    monthlyCents: monthly,
    totalCents: monthly.reduce((a, b) => a + b, 0),
  }
}
