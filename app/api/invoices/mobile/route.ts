import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { invoiceGrossCentsFromItems, vatFromSettings } from '@/lib/invoices/vat'

function customerDisplayName(c: {
  name: string | null
  first_name: string | null
  last_name: string | null
}): string {
  return c.name?.trim() || [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || 'Kunde'
}

type InvoiceListRow = {
  id: string
  invoice_number: string
  invoice_date: string
  sent_at: string | null
  status: string
  customer_id: string | null
  created_at: string
}

const SELECT_COLS =
  'id, invoice_number, invoice_date, sent_at, status, customer_id, created_at'

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const qTrim = (searchParams.get('q') ?? '').trim()
  const statusRaw = searchParams.get('status') || 'all'
  const status = statusRaw === 'open' || statusRaw === 'paid' ? statusRaw : 'all'
  const customerId = (searchParams.get('customerId') ?? '').trim()
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20))
  const offset = Math.max(0, Number(searchParams.get('offset')) || 0)

  const { data: settingsRow } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle()
  const vat = vatFromSettings((settingsRow?.settings ?? null) as Record<string, unknown> | null)

  const { data: openInvoices } = await supabase
    .from('invoices')
    .select('id')
    .eq('user_id', user.id)
    .in('status', ['draft', 'sent'])
  const openIds = (openInvoices ?? []).map((r) => r.id)
  let openTotalCents = 0
  if (openIds.length > 0) {
    const { data: items } = await supabase
      .from('invoice_items')
      .select('amount_cents, tax_rate_percent')
      .in('invoice_id', openIds)
    openTotalCents = invoiceGrossCentsFromItems(items ?? [], vat.kleinunternehmer, vat.taxRatePercent)
  }

  let filterIds: string[] | null = null
  if (qTrim) {
    const qPattern = `%${qTrim}%`
    const [{ data: byNumber }, custIdSet] = await Promise.all([
      supabase
        .from('invoices')
        .select('id')
        .eq('user_id', user.id)
        .ilike('invoice_number', qPattern)
        .returns<{ id: string }[]>(),
      (async () => {
        const set = new Set<string>()
        const textQ = qTrim.replace(/%/g, '')
        if (textQ) {
          const { data: custByText } = await supabase
            .from('customers')
            .select('id')
            .eq('user_id', user.id)
            .or(
              `name.ilike.%${textQ}%,first_name.ilike.%${textQ}%,last_name.ilike.%${textQ}%,company.ilike.%${textQ}%`
            )
          for (const c of custByText ?? []) set.add(c.id)
        }
        if (/^\d+$/.test(qTrim)) {
          const num = parseInt(qTrim, 10)
          const { data: custByNum } = await supabase
            .from('customers')
            .select('id')
            .eq('user_id', user.id)
            .eq('customer_number', num)
          for (const c of custByNum ?? []) set.add(c.id)
        }
        return set
      })(),
    ])
    const fromNumber = (byNumber ?? []).map((r) => r.id)
    let fromCustomer: string[] = []
    const custIds = [...custIdSet]
    if (custIds.length > 0) {
      const { data } = await supabase
        .from('invoices')
        .select('id')
        .eq('user_id', user.id)
        .in('customer_id', custIds)
        .returns<{ id: string }[]>()
      fromCustomer = (data ?? []).map((r) => r.id)
    }
    filterIds = [...new Set([...fromNumber, ...fromCustomer])]
    if (customerId) {
      // später per customer_id gefiltert; IDs bleiben, Query filtert zusätzlich
    }
  }

  let invoices: InvoiceListRow[] = []
  let total = 0

  if (filterIds !== null && filterIds.length === 0) {
    total = 0
  } else {
    let query = supabase
      .from('invoices')
      .select(SELECT_COLS, { count: 'exact' })
      .eq('user_id', user.id)
      .order('invoice_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (filterIds) query = query.in('id', filterIds)
    if (customerId) query = query.eq('customer_id', customerId)
    if (status === 'open') query = query.in('status', ['draft', 'sent'])
    else if (status === 'paid') query = query.eq('status', 'paid')

    const { data, count, error } = await query.range(offset, offset + limit - 1).returns<InvoiceListRow[]>()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    invoices = data ?? []
    total = count ?? 0
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
      .select('invoice_id, amount_cents, tax_rate_percent')
      .in('invoice_id', ids)
    const byInvoice = new Map<string, { amount_cents: number; tax_rate_percent: number }[]>()
    for (const row of items ?? []) {
      const list = byInvoice.get(row.invoice_id) ?? []
      list.push({
        amount_cents: row.amount_cents ?? 0,
        tax_rate_percent: Number(row.tax_rate_percent) || 0,
      })
      byInvoice.set(row.invoice_id, list)
    }
    for (const [invoiceId, invItems] of byInvoice) {
      totals.set(invoiceId, invoiceGrossCentsFromItems(invItems, vat.kleinunternehmer, vat.taxRatePercent))
    }
  }

  return NextResponse.json({
    openTotalCents,
    total,
    hasMore: offset + invoices.length < total,
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
