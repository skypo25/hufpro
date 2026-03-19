import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import NewInvoiceForm from '@/components/invoices/NewInvoiceForm'

type EditInvoicePageProps = {
  params: Promise<{ id: string }>
}

export default async function EditInvoicePage({ params }: EditInvoicePageProps) {
  const { id: invoiceId } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: inv, error: invErr } = await supabase
    .from('invoices')
    .select('id, invoice_number, invoice_date, service_date_from, payment_due_date, intro_text, footer_text, customer_id, buyer_name, buyer_company, buyer_street, buyer_zip, buyer_city, buyer_country, status')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single()

  if (invErr || !inv || inv.status !== 'draft') {
    notFound()
  }

  const customerId = inv.customer_id
  if (!customerId) {
    notFound()
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name, first_name, last_name, company, street, postal_code, city, country, email')
    .eq('id', customerId)
    .eq('user_id', user.id)
    .single()

  if (!customer) notFound()

  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, first_name, last_name, company, street, postal_code, city, country, email')
    .eq('user_id', user.id)
    .order('name')

  const { data: horses } = await supabase
    .from('horses')
    .select('id, name, breed')
    .eq('user_id', user.id)
    .eq('customer_id', customerId)
    .order('name')

  const { data: items } = await supabase
    .from('invoice_items')
    .select('description, quantity, unit_price_cents, amount_cents')
    .eq('invoice_id', invoiceId)
    .order('position', { ascending: true })

  const { data: settingsRow } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle<{ settings: Record<string, unknown> | null }>()

  const s = (settingsRow?.settings ?? {}) as Record<string, unknown>
  const services = (s.services as { label: string; price: string }[]) ?? [
    { label: 'Barhufbearbeitung (1 Pferd, 4 Hufe)', price: '65,00 €' },
  ]

  const customerName = customer.name?.trim() || [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim() || 'Kunde'
  const sellerName = (s.companyName as string)?.trim() || [s.firstName, s.lastName].filter(Boolean).join(' ') || 'Betrieb'
  const sellerAddress = [s.street, [s.zip, s.city].filter(Boolean).join(' '), s.country].filter(Boolean).join(', ') || '–'

  const invDate = inv.invoice_date?.toString().slice(0, 10) ?? new Date().toISOString().slice(0, 10)
  const dueDate = inv.payment_due_date?.toString().slice(0, 10) ?? ''
  const dueDays = dueDate && invDate ? Math.round((new Date(dueDate).getTime() - new Date(invDate).getTime()) / (1000 * 60 * 60 * 24)) : 7

  const lineItems = (items ?? []).map((row) => ({
    id: crypto.randomUUID(),
    description: row.description ?? '',
    optionalSuffix: '',
    horseId: '',
    quantity: Number(row.quantity) || 1,
    unitPriceCents: row.unit_price_cents ?? 0,
    amountCents: row.amount_cents ?? 0,
  }))

  const { data: invs } = await supabase
    .from('invoices')
    .select('id, invoice_date')
    .eq('user_id', user.id)
    .eq('customer_id', customerId)
    .order('invoice_date', { ascending: false })
  const invoiceIds = (invs ?? []).map((i) => i.id)
  let totalCents = 0
  let openCents = 0
  if (invoiceIds.length > 0) {
    const { data: allItems } = await supabase
      .from('invoice_items')
      .select('invoice_id, amount_cents')
      .in('invoice_id', invoiceIds)
    const statusByInv = new Map((invs ?? []).map((i) => [i.id, (i as { status?: string }).status]))
    for (const it of allItems ?? []) {
      totalCents += it.amount_cents
      const status = statusByInv.get(it.invoice_id)
      if (status !== 'paid' && status !== 'cancelled') openCents += it.amount_cents
    }
  }

  return (
    <div className="mx-auto max-w-[1220px]">
      <div className="mb-5 flex items-center gap-2 text-[13px] text-[#6B7280]">
        <Link href="/invoices" className="text-[#52b788] hover:underline">Rechnungen</Link>
        <span aria-hidden>›</span>
        <Link href={`/invoices/${invoiceId}`} className="text-[#52b788] hover:underline">{inv.invoice_number}</Link>
        <span aria-hidden>›</span>
        <span className="text-[#6B7280]">Bearbeiten</span>
      </div>

      <div className="mb-8">
        <h1 className="font-serif text-[28px] font-medium tracking-tight text-[#1B1F23]">Rechnung bearbeiten</h1>
        <p className="mt-1 text-[14px] text-[#6B7280]">Entwurf: {inv.invoice_number}</p>
      </div>

      <NewInvoiceForm
        nextInvoiceNumber=""
        customers={customers ?? []}
        initialCustomer={{ ...customer, name: customerName }}
        horses={horses ?? []}
        customerStats={{
          totalInvoices: invs?.length ?? 0,
          totalCents,
          openCents,
          lastInvoiceDate: invs?.[0]?.invoice_date ?? null,
        }}
        services={services}
        invoiceNumber={inv.invoice_number}
        defaultIntroText={(inv.intro_text as string) ?? ''}
        defaultFooterText={(inv.footer_text as string) ?? ''}
        sellerName={sellerName}
        sellerAddress={sellerAddress}
        editMode={{
          invoiceId,
          customerId,
          backHref: customerId ? `/customers/${customerId}/invoices` : '/invoices',
          initialInvoiceDate: invDate,
          initialServiceDate: inv.service_date_from?.toString().slice(0, 10) ?? invDate,
          initialPaymentDueDays: dueDays,
          initialLineItems: lineItems,
        }}
      />
    </div>
  )
}
