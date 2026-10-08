import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileInvoice, faPlus } from '@fortawesome/free-solid-svg-icons'
import CustomerInvoiceTableRows, { type InvoiceRowData } from '@/components/invoices/CustomerInvoiceTableRows'
import AppPage from '@/components/layout/AppPage'
import ListPagination, { parseListPageParams } from '@/components/ui/ListPagination'
import { invoiceGrossCentsFromItems, vatFromSettings } from '@/lib/invoices/vat'
import { getUserSettingsCached } from '@/lib/userSettings/getUserSettingsCached'
import { requireUserFeature } from '@/lib/admin/requireUserFeature'

type CustomerInvoicesPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string; perPage?: string }>
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

function getStatusBadge(status: string) {
  const s = (status || '').toLowerCase()
  if (s === 'paid') return { label: 'Bezahlt', class: 'bg-[#DCFCE7] text-[#166534]', dot: 'bg-[#34A853]' }
  if (s === 'sent') return { label: 'Offen', class: 'bg-[#FEF3C7] text-[#92400E]', dot: 'bg-[#F59E0B]' }
  if (s === 'cancelled') return { label: 'Storniert', class: 'bg-[#F3F4F6] text-[#9CA3AF]', dot: 'bg-[#9CA3AF]' }
  return { label: 'Entwurf', class: 'bg-[#F3F4F6] text-[#6B7280]', dot: 'bg-[#9CA3AF]' }
}

function isOverdue(paymentDue: string | null, status: string) {
  if (status === 'paid' || status === 'cancelled') return false
  if (!paymentDue) return false
  return new Date(paymentDue) < new Date()
}

function buildPageHref(customerId: string, page: number, perPage: number) {
  const params = new URLSearchParams()
  if (page > 1) params.set('page', String(page))
  if (perPage !== 10) params.set('perPage', String(perPage))
  const q = params.toString()
  return `/customers/${customerId}/invoices${q ? `?${q}` : ''}`
}

export default async function CustomerInvoicesPage({ params, searchParams }: CustomerInvoicesPageProps) {
  await requireUserFeature('invoices')
  const { id: customerId } = await params
  const sp = await searchParams
  const { page: currentPage, perPage: currentPerPage } = parseListPageParams(sp)

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name, first_name, last_name')
    .eq('id', customerId)
    .eq('user_id', user.id)
    .single()

  if (!customer) {
    return (
      <AppPage>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">Kunde nicht gefunden.</div>
      </AppPage>
    )
  }

  const customerName = customer.name?.trim() || [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim() || 'Kunde'

  const { data: horses } = await supabase
    .from('horses')
    .select('id, name')
    .eq('user_id', user.id)
    .eq('customer_id', customerId)
    .order('name')

  const horseNames = (horses ?? []).map((h) => h.name || '–').join(' · ')

  const settings = await getUserSettingsCached(user.id)
  const vat = vatFromSettings(settings)

  // Meta für Stats (alle Rechnungen des Kunden – leicht)
  const { data: allMeta } = await supabase
    .from('invoices')
    .select('id, status, payment_due_date')
    .eq('user_id', user.id)
    .eq('customer_id', customerId)

  const allInvoicesMeta = allMeta ?? []
  const allIds = allInvoicesMeta.map((i) => i.id)

  let totalsByInvoice = new Map<string, number>()
  if (allIds.length > 0) {
    const { data: items } = await supabase
      .from('invoice_items')
      .select('invoice_id, amount_cents, tax_rate_percent')
      .in('invoice_id', allIds)
    const byInvoice = new Map<string, { amount_cents: number; tax_rate_percent: number }[]>()
    for (const row of items ?? []) {
      const list = byInvoice.get(row.invoice_id) ?? []
      list.push({
        amount_cents: row.amount_cents ?? 0,
        tax_rate_percent: Number(row.tax_rate_percent) || 0,
      })
      byInvoice.set(row.invoice_id, list)
    }
    for (const [id, invItems] of byInvoice) {
      totalsByInvoice.set(id, invoiceGrossCentsFromItems(invItems, vat.kleinunternehmer, vat.taxRatePercent))
    }
  }

  const totalPaidCents = allInvoicesMeta
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + (totalsByInvoice.get(i.id) ?? 0), 0)
  const openCents = allInvoicesMeta
    .filter((i) => i.status !== 'paid' && i.status !== 'cancelled')
    .reduce((s, i) => s + (totalsByInvoice.get(i.id) ?? 0), 0)
  const overdueInvoices = allInvoicesMeta.filter((i) => isOverdue(i.payment_due_date, i.status))
  const overdueCents = overdueInvoices.reduce((s, i) => s + (totalsByInvoice.get(i.id) ?? 0), 0)

  // Seite
  let from = (currentPage - 1) * currentPerPage
  let to = from + currentPerPage - 1
  let { data: pageInvoices, count } = await supabase
    .from('invoices')
    .select('id, invoice_number, invoice_date, payment_due_date, status', { count: 'exact' })
    .eq('user_id', user.id)
    .eq('customer_id', customerId)
    .order('invoice_date', { ascending: false })
    .range(from, to)

  const totalRows = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalRows / currentPerPage) || 1)
  if (currentPage > totalPages && totalRows > 0) {
    from = (totalPages - 1) * currentPerPage
    to = from + currentPerPage - 1
    ;({ data: pageInvoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, invoice_date, payment_due_date, status')
      .eq('user_id', user.id)
      .eq('customer_id', customerId)
      .order('invoice_date', { ascending: false })
      .range(from, to))
  }

  const safePage = Math.min(currentPage, totalPages)
  const startIndex = totalRows === 0 ? 0 : (safePage - 1) * currentPerPage
  const endIndex = startIndex + currentPerPage
  const invoices = pageInvoices ?? []

  // Beschreibungen nur für die aktuelle Seite
  const pageIds = invoices.map((i) => i.id)
  const firstDescByInvoice = new Map<string, string>()
  if (pageIds.length > 0) {
    const { data: pageItems } = await supabase
      .from('invoice_items')
      .select('invoice_id, description, position')
      .in('invoice_id', pageIds)
      .order('position', { ascending: true })
    for (const it of pageItems ?? []) {
      if (!firstDescByInvoice.has(it.invoice_id)) {
        firstDescByInvoice.set(it.invoice_id, it.description ?? '–')
      }
    }
  }

  return (
    <AppPage>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-serif text-[28px] font-medium tracking-tight text-[#1B1F23]">Rechnungen</h1>
          <p className="mt-1 text-[14px] text-[#6B7280]">Alle Rechnungen für {customerName}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/invoices/new?customerId=${customerId}`}
            className="primary-button"
          >
            <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
            Neue Rechnung
          </Link>
        </div>
      </div>

      {/* Tabs like customer detail */}
      <div className="flex gap-0 border-b-2 border-[#E5E2DC]">
        <Link href={`/customers/${customerId}`} className="border-b-2 border-transparent px-5 py-3 text-[14px] font-medium text-[#6B7280] hover:text-[#1B1F23]">Übersicht</Link>
        <span className="px-5 py-3 text-[14px] font-medium text-[#6B7280]">Termine</span>
        <span className="px-5 py-3 text-[14px] font-medium text-[#6B7280]">Dokumentation</span>
        <span className="border-b-2 border-primary px-5 py-3 text-[14px] font-medium text-primary">Rechnungen</span>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="content-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Rechnungen gesamt</div>
          <div className="font-serif text-[26px] !font-extrabold text-[#1B1F23]">{totalRows}</div>
        </div>
        <div className="content-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Bezahlt</div>
          <div className="font-serif text-[26px] !font-extrabold text-primary">{formatCurrency(totalPaidCents)}</div>
          <div className="text-[11px] text-[#9CA3AF]">{allInvoicesMeta.filter((i) => i.status === 'paid').length} Rechnungen</div>
        </div>
        <div className="content-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Offen</div>
          <div className="font-serif text-[26px] !font-extrabold text-[#F59E0B]">{formatCurrency(openCents)}</div>
          <div className="text-[11px] text-[#9CA3AF]">{allInvoicesMeta.filter((i) => i.status !== 'paid' && i.status !== 'cancelled').length} Rechnungen</div>
        </div>
        <div className="content-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Überfällig</div>
          <div className="font-serif text-[26px] !font-extrabold text-[#EF4444]">{formatCurrency(overdueCents)}</div>
          <div className="text-[11px] text-[#9CA3AF]">{overdueInvoices.length} Rechnung(en)</div>
        </div>
      </div>

      {/* Overdue banner */}
      {overdueInvoices.length > 0 && (
        <div className="flex items-center gap-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FEE2E2] text-[#991B1B]">
            <FontAwesomeIcon icon={faFileInvoice} className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 text-[14px] text-[#991B1B]">
            <strong>{overdueInvoices.length} Rechnung(en) überfällig.</strong> Fällig seit dem Fälligkeitsdatum. Zahlungserinnerung optional senden.
          </div>
        </div>
      )}

      {/* Table */}
      <div className="content-card">
        <div className="grid grid-cols-[48px_130px_1fr_110px_100px_80px] gap-3 border-b-2 border-[#E5E2DC] bg-black/[0.02] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] md:grid-cols-[48px_130px_1fr_140px_110px_100px_80px]">
          <div />
          <div>Rechnung</div>
          <div>Leistung</div>
          <div className="text-right">Betrag</div>
          <div className="text-center">Status</div>
          <div className="text-right">Optionen</div>
        </div>
        {invoices.length === 0 ? (
          <div className="px-6 py-16 text-center text-[14px] text-[#6B7280]">
            Noch keine Rechnungen für diesen Kunden. <Link href={`/invoices/new?customerId=${customerId}`} className="text-primary hover:underline">Neue Rechnung anlegen</Link>
          </div>
        ) : (
          <>
            <CustomerInvoiceTableRows
              rows={invoices.map((inv) => {
                const totalCents = totalsByInvoice.get(inv.id) ?? 0
                const firstDesc = firstDescByInvoice.get(inv.id) ?? '–'
                const overdue = isOverdue(inv.payment_due_date, inv.status)
                const badge = getStatusBadge(inv.status)
                const statusLabel = overdue && inv.status !== 'paid' && inv.status !== 'cancelled' ? 'Überfällig' : badge.label
                const statusClass = overdue && inv.status !== 'paid' ? 'bg-[#FEE2E2] text-[#991B1B]' : badge.class
                return {
                  id: inv.id,
                  invoice_number: inv.invoice_number,
                  invoice_date: inv.invoice_date,
                  payment_due_date: inv.payment_due_date,
                  status: inv.status,
                  totalCents,
                  firstDesc,
                  statusLabel,
                  statusClass,
                  overdue,
                } satisfies InvoiceRowData
              })}
              horseNames={horseNames}
            />
            <ListPagination
              totalRows={totalRows}
              currentPage={safePage}
              totalPages={totalPages}
              perPage={currentPerPage}
              startIndex={startIndex}
              endIndex={endIndex}
              itemLabel="Rechnungen"
              buildHref={(page, perPage) => buildPageHref(customerId, page, perPage)}
            />
          </>
        )}
      </div>
    </AppPage>
  )
}
