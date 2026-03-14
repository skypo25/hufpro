import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import NewInvoiceForm from '@/components/invoices/NewInvoiceForm'

type NewInvoicePageProps = {
  searchParams: Promise<{ customerId?: string }>
}

export default async function NewInvoicePage({ searchParams }: NewInvoicePageProps) {
  const { customerId: preselectedCustomerId } = await searchParams
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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
  const prefix = ((s.invoicePrefix as string) ?? 'HUF-').replace(/\s/g, '')
  const nextRaw = (s.nextInvoiceNumber as string) ?? '2026-0001'
  const match = nextRaw.match(/^(\d{4})-(\d+)$/)
  const year = new Date().getFullYear().toString()
  const num = match ? parseInt(match[2], 10) : 1
  const nextNumber = `${year}-${String(num).padStart(4, '0')}`
  const invoiceNumber = `${prefix}${nextNumber}`

  const services = (s.services as { label: string; price: string }[]) ?? [
    { label: 'Barhufbearbeitung (1 Pferd, 4 Hufe)', price: '65,00 €' },
  ]
  const introText = (s.invoiceTextTop as string) ?? 'Vielen Dank für Ihr Vertrauen. Ich erlaube mir, folgende Leistungen in Rechnung zu stellen:'
  const footerText = (s.invoiceTextBottom as string) ?? 'Bitte überweisen Sie den Betrag innerhalb von 7 Tagen auf das unten angegebene Konto. Bei Fragen stehe ich Ihnen gerne zur Verfügung.'

  let initialCustomer: {
    id: string
    name: string
    first_name: string | null
    last_name: string | null
    company: string | null
    street: string | null
    postal_code: string | null
    city: string | null
    country: string | null
    email: string | null
  } | null = null
  let horses: { id: string; name: string | null; breed: string | null }[] = []
  let customerStats: { totalInvoices: number; totalCents: number; openCents: number; lastInvoiceDate: string | null } | null = null

  if (preselectedCustomerId?.trim()) {
    const { data: cust } = await supabase
      .from('customers')
      .select('id, name, first_name, last_name, company, street, postal_code, city, country, email')
      .eq('id', preselectedCustomerId.trim())
      .eq('user_id', user.id)
      .single()
    if (cust) {
      const name = cust.name?.trim() || [cust.first_name, cust.last_name].filter(Boolean).join(' ').trim() || 'Kunde'
      initialCustomer = { ...cust, name }
      const { data: horsesData } = await supabase
        .from('horses')
        .select('id, name, breed')
        .eq('user_id', user.id)
        .eq('customer_id', cust.id)
        .order('name')
      horses = horsesData ?? []
      const { data: invs } = await supabase
        .from('invoices')
        .select('id, invoice_date')
        .eq('user_id', user.id)
        .eq('customer_id', cust.id)
        .order('invoice_date', { ascending: false })
      const invoiceIds = (invs ?? []).map((i) => i.id)
      let totalCents = 0
      let openCents = 0
      if (invoiceIds.length > 0) {
        const { data: items } = await supabase
          .from('invoice_items')
          .select('invoice_id, amount_cents')
          .in('invoice_id', invoiceIds)
        const statusByInv = new Map((invs ?? []).map((i) => [i.id, i]))
        for (const it of items ?? []) {
          totalCents += it.amount_cents
          const inv = statusByInv.get(it.invoice_id)
          if (inv && inv.invoice_date) {
            const status = (inv as { status?: string }).status
            if (status !== 'paid' && status !== 'cancelled') openCents += it.amount_cents
          }
        }
      }
      customerStats = {
        totalInvoices: invs?.length ?? 0,
        totalCents,
        openCents,
        lastInvoiceDate: invs?.[0]?.invoice_date ?? null,
      }
    }
  }

  const sellerName = (s.companyName as string)?.trim() || [s.firstName, s.lastName].filter(Boolean).join(' ') || 'Betrieb'
  const sellerAddress = [s.street, [s.zip, s.city].filter(Boolean).join(' '), s.country].filter(Boolean).join(', ') || '–'

  return (
    <div className="mx-auto max-w-[1280px] w-full space-y-7">
      <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
        <Link href="/invoices" className="text-[#154226] hover:underline">Rechnungen</Link>
        <span aria-hidden>›</span>
        <span className="text-[#6B7280]">Neue Rechnung erstellen</span>
      </div>

      <div>
        <h1 className="font-serif text-[28px] font-medium tracking-tight text-[#1B1F23]">Neue Rechnung erstellen</h1>
        <p className="mt-1 text-[14px] text-[#6B7280]">Rechnungsnummer wird automatisch vergeben</p>
      </div>

      <NewInvoiceForm
        customers={customers ?? []}
        initialCustomer={initialCustomer}
        horses={horses}
        customerStats={customerStats}
        services={services}
        invoiceNumber={invoiceNumber}
        nextInvoiceNumber={nextNumber}
        defaultIntroText={introText}
        defaultFooterText={footerText}
        sellerName={sellerName}
        sellerAddress={sellerAddress}
      />
    </div>
  )
}
