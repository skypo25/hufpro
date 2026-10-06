import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faFileInvoice } from '@fortawesome/free-solid-svg-icons'
import InvoiceListRowWithMenu from '@/components/invoices/InvoiceListRowWithMenu'
import InvoicesListSearchForm from '@/components/invoices/InvoicesListSearchForm'
import AppPage from '@/components/layout/AppPage'
import ListPagination, { parseListPageParams } from '@/components/ui/ListPagination'
import { invoiceGrossCentsFromItems, vatFromSettings } from '@/lib/invoices/vat'
import { getUserSettingsCached } from '@/lib/userSettings/getUserSettingsCached'

type InvoicesPageProps = {
  searchParams: Promise<{ q?: string; status?: string; page?: string; perPage?: string }>
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

function formatOpenSum(cents: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

function buildPageHref({
  q,
  status,
  page,
  perPage,
}: {
  q: string
  status: string
  page: number
  perPage: number
}) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (status && status !== 'all') params.set('status', status)
  if (page > 1) params.set('page', String(page))
  if (perPage !== 10) params.set('perPage', String(perPage))
  const query = params.toString()
  return `/invoices${query ? `?${query}` : ''}`
}

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { q = '', status: statusRaw, page: pageParam, perPage: perPageParam } = await searchParams
  const qTrim = (typeof q === 'string' ? q : '').trim()
  const status = statusRaw === 'open' || statusRaw === 'paid' ? statusRaw : 'all'
  const { page: currentPage, perPage: currentPerPage } = parseListPageParams({
    page: pageParam,
    perPage: perPageParam,
  })

  const settings = await getUserSettingsCached(user.id)
  const vat = vatFromSettings(settings)

  // Summe offener Rechnungen (gesamt, unabhängig von Seite/Filter)
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
  }

  let invoices: InvoiceListRow[] = []
  let totalRows = 0

  if (filterIds !== null && filterIds.length === 0) {
    totalRows = 0
  } else {
    const build = () => {
      let query = supabase
        .from('invoices')
        .select(SELECT_COLS, { count: 'exact' })
        .eq('user_id', user.id)
        .order('invoice_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (filterIds) query = query.in('id', filterIds)
      if (status === 'open') query = query.in('status', ['draft', 'sent'])
      else if (status === 'paid') query = query.eq('status', 'paid')
      return query
    }

    let from = (currentPage - 1) * currentPerPage
    let to = from + currentPerPage - 1
    let { data, count, error } = await build().range(from, to).returns<InvoiceListRow[]>()
    if (error) {
      return (
        <AppPage>
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
            Rechnungen konnten nicht geladen werden: {error.message}
          </div>
        </AppPage>
      )
    }
    totalRows = count ?? 0
    const totalPagesTmp = Math.max(1, Math.ceil(totalRows / currentPerPage) || 1)
    if (currentPage > totalPagesTmp && totalRows > 0) {
      from = (totalPagesTmp - 1) * currentPerPage
      to = from + currentPerPage - 1
      ;({ data, count } = await build().range(from, to).returns<InvoiceListRow[]>())
      totalRows = count ?? totalRows
    }
    invoices = data ?? []
  }

  const totalPages = Math.max(1, Math.ceil(totalRows / currentPerPage) || 1)
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = totalRows === 0 ? 0 : (safePage - 1) * currentPerPage
  const endIndex = startIndex + currentPerPage

  const customerIds = [...new Set(invoices.map((i) => i.customer_id).filter(Boolean) as string[])]
  const customerNames: Record<string, string> = {}
  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, first_name, last_name')
      .in('id', customerIds)
    for (const c of customers ?? []) {
      const name =
        c.name?.trim() || [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || 'Kunde'
      customerNames[c.id] = name
    }
  }

  return (
    <AppPage>
      <div className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-[28px] font-medium tracking-tight text-[#1B1F23]">Rechnungen</h1>
          <p className="mt-1 text-[14px] text-[#6B7280]">Offene Rechnungen: {formatOpenSum(openTotalCents)}</p>
        </div>
        <Link href="/invoices/new" className="primary-button">
          <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
          Neue Rechnung
        </Link>
      </div>

      <InvoicesListSearchForm q={qTrim} status={status} />

      <div className="content-card">
        {!invoices.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-2xl text-primary">
              <FontAwesomeIcon icon={faFileInvoice} />
            </div>
            <p className="text-[15px] font-medium text-[#1B1F23]">
              {qTrim || status !== 'all' ? 'Keine Treffer' : 'Noch keine Rechnungen'}
            </p>
            <p className="mt-1 text-[14px] text-[#6B7280]">
              {qTrim || status !== 'all'
                ? 'Passe die Suche oder den Filter an.'
                : 'Erstelle deine erste Rechnung für einen Kunden.'}
            </p>
            {!qTrim && status === 'all' ? (
              <Link href="/invoices/new" className="primary-button mt-6">
                <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
                Neue Rechnung erstellen
              </Link>
            ) : null}
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
              {invoices.map((inv) => (
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

            <ListPagination
              totalRows={totalRows}
              currentPage={safePage}
              totalPages={totalPages}
              perPage={currentPerPage}
              startIndex={startIndex}
              endIndex={endIndex}
              itemLabel="Rechnungen"
              buildHref={(page, perPage) =>
                buildPageHref({ q: qTrim, status, page, perPage })
              }
              perPageFormFields={{
                ...(qTrim ? { q: qTrim } : {}),
                ...(status !== 'all' ? { status } : {}),
              }}
            />
          </>
        )}
      </div>
    </AppPage>
  )
}
