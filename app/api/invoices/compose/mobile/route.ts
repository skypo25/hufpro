import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { vatFromSettings } from '@/lib/invoices/vat'

type Customer = {
  id: string
  name: string | null
  first_name: string | null
  last_name: string | null
  company: string | null
  street: string | null
  postal_code: string | null
  city: string | null
  country: string | null
  email: string | null
}

function displayName(c: Customer): string {
  return c.name?.trim() || [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || 'Kunde'
}

async function customerStats(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  customerId: string
) {
  const { data: invs } = await supabase
    .from('invoices')
    .select('id, invoice_date, status')
    .eq('user_id', userId)
    .eq('customer_id', customerId)
    .order('invoice_date', { ascending: false })
  const invoiceIds = (invs ?? []).map((i) => i.id)
  let totalCents = 0
  let openCents = 0
  if (invoiceIds.length > 0) {
    const { data: items } = await supabase
      .from('invoice_items')
      .select('invoice_id, amount_cents')
      .in('invoice_id', invoiceIds)
    const statusByInv = new Map((invs ?? []).map((i) => [i.id, i.status]))
    for (const it of items ?? []) {
      totalCents += it.amount_cents ?? 0
      const status = statusByInv.get(it.invoice_id)
      if (status !== 'paid' && status !== 'cancelled') openCents += it.amount_cents ?? 0
    }
  }
  return {
    totalInvoices: invs?.length ?? 0,
    totalCents,
    openCents,
    lastInvoiceDate: invs?.[0]?.invoice_date ?? null,
  }
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const invoiceId = (searchParams.get('invoiceId') ?? '').trim()
  const customerIdParam = (searchParams.get('customerId') ?? '').trim()

  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, first_name, last_name, company, street, postal_code, city, country, email')
    .eq('user_id', user.id)
    .order('name')

  const { data: settingsRow } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle<{ settings: Record<string, unknown> | null }>()

  const s = (settingsRow?.settings ?? {}) as Record<string, unknown>
  const vat = vatFromSettings(s)
  const services = (s.services as { label: string; price: string }[]) ?? [
    { label: 'Barhufbearbeitung (1 Pferd, 4 Hufe)', price: '65,00 €' },
  ]
  const sellerName = (s.companyName as string)?.trim() || [s.firstName, s.lastName].filter(Boolean).join(' ') || 'Betrieb'
  const sellerAddress = [s.street, [s.zip, s.city].filter(Boolean).join(' '), s.country].filter(Boolean).join(', ') || '–'

  if (invoiceId) {
    const { data: inv } = await supabase
      .from('invoices')
      .select(
        'id, invoice_number, invoice_date, service_date_from, payment_due_date, intro_text, footer_text, customer_id, status'
      )
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .single()

    if (!inv || inv.status !== 'draft' || !inv.customer_id) {
      return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('id, name, first_name, last_name, company, street, postal_code, city, country, email')
      .eq('id', inv.customer_id)
      .eq('user_id', user.id)
      .single()
    if (!customer) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

    const { data: horses } = await supabase
      .from('horses')
      .select('id, name, breed')
      .eq('user_id', user.id)
      .eq('customer_id', inv.customer_id)
      .order('name')

    const { data: items } = await supabase
      .from('invoice_items')
      .select('description, quantity, unit_price_cents, amount_cents')
      .eq('invoice_id', invoiceId)
      .order('position', { ascending: true })

    const invDate = inv.invoice_date?.toString().slice(0, 10) ?? new Date().toISOString().slice(0, 10)
    const dueDate = inv.payment_due_date?.toString().slice(0, 10) ?? ''
    const dueDays =
      dueDate && invDate
        ? Math.round((new Date(dueDate).getTime() - new Date(invDate).getTime()) / (1000 * 60 * 60 * 24))
        : 7

    return NextResponse.json({
      mode: 'edit',
      customers: customers ?? [],
      initialCustomer: { ...customer, name: displayName(customer) },
      horses: horses ?? [],
      customerStats: await customerStats(supabase, user.id, inv.customer_id),
      services,
      invoiceNumber: inv.invoice_number,
      nextInvoiceNumber: '',
      defaultIntroText: (inv.intro_text as string) ?? '',
      defaultFooterText: (inv.footer_text as string) ?? '',
      sellerName,
      sellerAddress,
      kleinunternehmer: vat.kleinunternehmer,
      taxRatePercent: vat.taxRatePercent,
      editMode: {
        invoiceId,
        customerId: inv.customer_id,
        backHref: '/invoices',
        initialInvoiceDate: invDate,
        initialServiceDate: inv.service_date_from?.toString().slice(0, 10) ?? invDate,
        initialPaymentDueDays: dueDays,
        initialLineItems: (items ?? []).map((row) => ({
          id: crypto.randomUUID(),
          description: row.description ?? '',
          optionalSuffix: '',
          horseId: '',
          quantity: Number(row.quantity) || 1,
          unitPriceCents: row.unit_price_cents ?? 0,
          amountCents: row.amount_cents ?? 0,
        })),
      },
    })
  }

  const prefix = ((s.invoicePrefix as string) ?? 'HUF-').replace(/\s/g, '')
  const nextRaw = (s.nextInvoiceNumber as string) ?? '2026-0001'
  const match = nextRaw.match(/^(\d{4})-(\d+)$/)
  const year = new Date().getFullYear().toString()
  const num = match ? parseInt(match[2], 10) : 1
  const nextNumber = `${year}-${String(num).padStart(4, '0')}`
  const invoiceNumber = `${prefix}${nextNumber}`
  const introText =
    (s.invoiceTextTop as string) ??
    'Vielen Dank für Ihr Vertrauen. Ich erlaube mir, folgende Leistungen in Rechnung zu stellen:'
  const footerText =
    (s.invoiceTextBottom as string) ??
    'Bitte überweisen Sie den Betrag innerhalb von 7 Tagen auf das unten angegebene Konto. Bei Fragen stehe ich Ihnen gerne zur Verfügung.'

  let initialCustomer: (Customer & { name: string }) | null = null
  let horses: { id: string; name: string | null; breed: string | null }[] = []
  let stats = null

  if (customerIdParam) {
    const { data: cust } = await supabase
      .from('customers')
      .select('id, name, first_name, last_name, company, street, postal_code, city, country, email')
      .eq('id', customerIdParam)
      .eq('user_id', user.id)
      .single()
    if (cust) {
      initialCustomer = { ...cust, name: displayName(cust) }
      const { data: horsesData } = await supabase
        .from('horses')
        .select('id, name, breed')
        .eq('user_id', user.id)
        .eq('customer_id', cust.id)
        .order('name')
      horses = horsesData ?? []
      stats = await customerStats(supabase, user.id, cust.id)
    }
  }

  return NextResponse.json({
    mode: 'create',
    customers: customers ?? [],
    initialCustomer,
    horses,
    customerStats: stats,
    services,
    invoiceNumber,
    nextInvoiceNumber: nextNumber,
    defaultIntroText: introText,
    defaultFooterText: footerText,
    sellerName,
    sellerAddress,
    kleinunternehmer: vat.kleinunternehmer,
    taxRatePercent: vat.taxRatePercent,
  })
}
