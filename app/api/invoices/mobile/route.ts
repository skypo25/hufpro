import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

function customerDisplayName(c: {
  name: string | null
  first_name: string | null
  last_name: string | null
}): string {
  return c.name?.trim() || [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || 'Kunde'
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const qTrim = (searchParams.get('q') ?? '').trim()
  const status = searchParams.get('status') || 'all'
  const customerId = (searchParams.get('customerId') ?? '').trim()
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50))

  const { data: openInvoices } = await supabase
    .from('invoices')
    .select('id')
    .eq('user_id', user.id)
    .in('status', ['draft', 'sent'])
  const openIds = (openInvoices ?? []).map((r) => r.id)
  let openTotalCents = 0
  if (openIds.length > 0) {
    const { data: items } = await supabase.from('invoice_items').select('amount_cents').in('invoice_id', openIds)
    openTotalCents = (items ?? []).reduce((sum, row) => sum + (row.amount_cents ?? 0), 0)
  }

  let invoices: {
    id: string
    invoice_number: string
    invoice_date: string
    sent_at: string | null
    status: string
    customer_id: string | null
    created_at: string
  }[] = []

  const selectCols = 'id, invoice_number, invoice_date, sent_at, status, customer_id, created_at'

  if (qTrim) {
    const qPattern = `%${qTrim}%`
    const byNumberRes = await supabase
      .from('invoices')
      .select(selectCols)
      .eq('user_id', user.id)
      .ilike('invoice_number', qPattern)
      .order('invoice_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)
    const byNumber = byNumberRes.data ?? []
    const custIdSet = new Set<string>()
    const textQ = qTrim.replace(/%/g, '')
    if (textQ) {
      const { data: custByText } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .or(`name.ilike.%${textQ}%,first_name.ilike.%${textQ}%,last_name.ilike.%${textQ}%,company.ilike.%${textQ}%`)
      for (const c of custByText ?? []) custIdSet.add(c.id)
    }
    if (/^\d+$/.test(qTrim)) {
      const num = parseInt(qTrim, 10)
      const { data: custByNum } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .eq('customer_number', num)
      for (const c of custByNum ?? []) custIdSet.add(c.id)
    }
    const custIds = [...custIdSet]
    let byCustomer: typeof byNumber = []
    if (custIds.length > 0) {
      const { data } = await supabase
        .from('invoices')
        .select(selectCols)
        .eq('user_id', user.id)
        .in('customer_id', custIds)
        .order('invoice_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit)
      byCustomer = data ?? []
    }
    const seen = new Set<string>()
    invoices = [...byNumber, ...byCustomer].filter((inv) => {
      if (seen.has(inv.id)) return false
      seen.add(inv.id)
      return true
    })
    invoices.sort((a, b) => {
      const d = (b.invoice_date || '').localeCompare(a.invoice_date || '')
      if (d !== 0) return d
      return (b.created_at || '').localeCompare(a.created_at || '')
    })
  } else {
    let query = supabase
      .from('invoices')
      .select(selectCols)
      .eq('user_id', user.id)
      .order('invoice_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)
    if (customerId) query = query.eq('customer_id', customerId)
    if (status === 'open') query = query.in('status', ['draft', 'sent'])
    else if (status === 'paid') query = query.eq('status', 'paid')
    const { data } = await query
    invoices = data ?? []
  }

  if (status && status !== 'all') {
    if (status === 'open') invoices = invoices.filter((i) => i.status === 'draft' || i.status === 'sent')
    else if (status === 'paid') invoices = invoices.filter((i) => i.status === 'paid')
  }
  if (customerId && qTrim) {
    invoices = invoices.filter((i) => i.customer_id === customerId)
  }

  const customerIds = [...new Set(invoices.map((i) => i.customer_id).filter(Boolean) as string[])]
  const customerNames: Record<string, string> = {}
  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, first_name, last_name')
      .in('id', customerIds)
    for (const c of customers ?? []) {
      customerNames[c.id] = customerDisplayName(c)
    }
  }

  const ids = invoices.map((i) => i.id)
  const totals = new Map<string, number>()
  if (ids.length > 0) {
    const { data: items } = await supabase
      .from('invoice_items')
      .select('invoice_id, amount_cents')
      .in('invoice_id', ids)
    for (const row of items ?? []) {
      totals.set(row.invoice_id, (totals.get(row.invoice_id) ?? 0) + (row.amount_cents ?? 0))
    }
  }

  return NextResponse.json({
    openTotalCents,
    invoices: invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      invoiceDate: inv.invoice_date,
      sentAt: inv.sent_at,
      status: inv.status,
      customerId: inv.customer_id,
      customerName: inv.customer_id ? customerNames[inv.customer_id] ?? 'Kunde' : '–',
      totalCents: totals.get(inv.id) ?? 0,
    })),
  })
}
