import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faFileInvoice } from '@fortawesome/free-solid-svg-icons'
import InvoiceListRowWithMenu from '@/components/invoices/InvoiceListRowWithMenu'
import InvoicesListSearchForm from '@/components/invoices/InvoicesListSearchForm'

type InvoicesPageProps = {
  searchParams: Promise<{ q?: string; status?: string }>
}

function formatOpenSum(cents: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { q = '', status } = await searchParams
  const qTrim = (typeof q === 'string' ? q : '').trim()

  // Summe offener Rechnungen (Entwurf + Versendet)
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
      .select('amount_cents')
      .in('invoice_id', openIds)
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
  }[] | null = null

  if (qTrim) {
    const qPattern = `%${qTrim}%`
    const byNumberRes = await supabase
      .from('invoices')
      .select('id, invoice_number, invoice_date, sent_at, status, customer_id, created_at')
      .eq('user_id', user.id)
      .ilike('invoice_number', qPattern)
      .order('invoice_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100)
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
        .select('id, invoice_number, invoice_date, sent_at, status, customer_id, created_at')
        .eq('user_id', user.id)
        .in('customer_id', custIds)
        .order('invoice_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100)
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
      .select('id, invoice_number, invoice_date, sent_at, status, customer_id, created_at')
      .eq('user_id', user.id)
      .order('invoice_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100)
    if (status === 'open') query = query.in('status', ['draft', 'sent'])
    else if (status === 'paid') query = query.eq('status', 'paid')
    const { data } = await query
    invoices = data
  }

  if (invoices && status && status !== 'all') {
    if (status === 'open') invoices = invoices.filter((i) => i.status === 'draft' || i.status === 'sent')
    else if (status === 'paid') invoices = invoices.filter((i) => i.status === 'paid')
  }

  const customerIds = [...new Set((invoices ?? []).map((i) => i.customer_id).filter(Boolean) as string[])]
  let customerNames: Record<string, string> = {}
  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, first_name, last_name')
      .in('id', customerIds)
    for (const c of customers ?? []) {
      const name = c.name?.trim() || [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || 'Kunde'
      customerNames[c.id] = name
    }
  }

  return (
    <div className="mx-auto max-w-[1280px] w-full space-y-7">
      <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
        <Link href="/dashboard" className="text-[#52b788] hover:underline">Dashboard</Link>
        <span aria-hidden>›</span>
        <span className="text-[#6B7280]">Rechnungen</span>
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-[28px] font-medium tracking-tight text-[#1B1F23]">Rechnungen</h1>
          <p className="mt-1 text-[14px] text-[#6B7280]">Offene Rechnungen: {formatOpenSum(openTotalCents)}</p>
        </div>
        <Link
          href="/invoices/new"
          className="huf-btn-dark inline-flex items-center gap-2 rounded-lg bg-[#52b788] px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-[#0f301b]"
        >
          <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
          Neue Rechnung
        </Link>
      </div>

      <InvoicesListSearchForm q={qTrim} status={status ?? 'all'} />

      <div className="huf-card">
        {!invoices?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf3ef] text-2xl text-[#52b788]">
              <FontAwesomeIcon icon={faFileInvoice} />
            </div>
            <p className="text-[15px] font-medium text-[#1B1F23]">Noch keine Rechnungen</p>
            <p className="mt-1 text-[14px] text-[#6B7280]">Erstelle deine erste Rechnung für einen Kunden.</p>
            <Link
              href="/invoices/new"
              className="huf-btn-dark mt-6 inline-flex items-center gap-2 rounded-lg bg-[#52b788] px-4 py-2.5 text-[14px] font-medium text-white hover:bg-[#0f301b]"
            >
              <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
              Neue Rechnung erstellen
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[140px_220px_1fr_120px_44px_52px] items-center gap-6 border-b-2 border-[#E5E2DC] bg-[rgba(0,0,0,0.02)] px-[22px] py-[14px] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] max-[700px]:grid-cols-[130px_1fr_120px_44px_52px] max-[700px]:[&>*:nth-child(2)]:hidden">
              <div>Datum</div>
              <div>Rechnung</div>
              <div>Kunde</div>
              <div className="text-right">Status</div>
              <div></div>
              <div></div>
            </div>

            <div>
              {(invoices ?? []).map((inv) => (
                <InvoiceListRowWithMenu
                  key={inv.id}
                  id={inv.id}
                  invoiceNumber={inv.invoice_number}
                  customerName={inv.customer_id ? customerNames[inv.customer_id] ?? 'Kunde' : '–'}
                  invoiceDate={inv.invoice_date}
                  sentAt={inv.sent_at}
                  status={inv.status}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
