import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileInvoice, faPlus } from '@fortawesome/free-solid-svg-icons'
import CustomerInvoiceTableRows, { type InvoiceRowData } from '@/components/invoices/CustomerInvoiceTableRows'

type CustomerInvoicesPageProps = {
  params: Promise<{ id: string }>
}

function formatDate(d: string | null) {
  if (!d) return '–'
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return d
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
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

export default async function CustomerInvoicesPage({ params }: CustomerInvoicesPageProps) {
  const { id: customerId } = await params
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
      <main className="mx-auto max-w-[1280px] w-full space-y-7">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">Kunde nicht gefunden.</div>
      </main>
    )
  }

  const customerName = customer.name?.trim() || [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim() || 'Kunde'

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, invoice_date, payment_due_date, status')
    .eq('user_id', user.id)
    .eq('customer_id', customerId)
    .order('invoice_date', { ascending: false })

  const { data: horses } = await supabase
    .from('horses')
    .select('id, name')
    .eq('user_id', user.id)
    .eq('customer_id', customerId)
    .order('name')

  const horseNames = (horses ?? []).map((h) => h.name || '–').join(' · ')
  const invoiceIds = (invoices ?? []).map((i) => i.id)

  let itemsByInvoice: Map<string, { description: string; totalCents: number }> = new Map()
  if (invoiceIds.length > 0) {
    const { data: items } = await supabase
      .from('invoice_items')
      .select('invoice_id, description, amount_cents')
      .in('invoice_id', invoiceIds)
    for (const inv of invoices ?? []) {
      const invItems = (items ?? []).filter((it) => it.invoice_id === inv.id)
      const totalCents = invItems.reduce((s, it) => s + it.amount_cents, 0)
      const firstDesc = invItems[0]?.description ?? '–'
      itemsByInvoice.set(inv.id, { description: firstDesc, totalCents })
    }
  }

  const totalPaidCents = (invoices ?? [])
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + (itemsByInvoice.get(i.id)?.totalCents ?? 0), 0)
  const openCents = (invoices ?? [])
    .filter((i) => i.status !== 'paid' && i.status !== 'cancelled')
    .reduce((s, i) => s + (itemsByInvoice.get(i.id)?.totalCents ?? 0), 0)
  const overdueInvoices = (invoices ?? []).filter((i) => isOverdue(i.payment_due_date, i.status))
  const overdueCents = overdueInvoices.reduce((s, i) => s + (itemsByInvoice.get(i.id)?.totalCents ?? 0), 0)

  return (
    <main className="mx-auto max-w-[1280px] w-full space-y-7">
      <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
        <Link href="/dashboard" className="text-[#154226] hover:underline">Dashboard</Link>
        <span>›</span>
        <Link href="/customers" className="text-[#154226] hover:underline">Kunden</Link>
        <span>›</span>
        <Link href={`/customers/${customerId}`} className="text-[#154226] hover:underline">{customerName}</Link>
        <span>›</span>
        <span className="text-[#6B7280]">Rechnungen</span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-serif text-[28px] font-medium tracking-tight text-[#1B1F23]">Rechnungen</h1>
          <p className="mt-1 text-[14px] text-[#6B7280]">Alle Rechnungen für {customerName} · Kleinunternehmer §19 UStG</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/invoices/new?customerId=${customerId}`}
            className="huf-btn-dark inline-flex items-center gap-2 rounded-lg bg-[#154226] px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[#0f301b]"
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
        <span className="border-b-2 border-[#154226] px-5 py-3 text-[14px] font-medium text-[#154226]">Rechnungen</span>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#E5E2DC] bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Rechnungen gesamt</div>
          <div className="font-serif text-[24px] font-medium text-[#1B1F23]">{(invoices ?? []).length}</div>
        </div>
        <div className="rounded-xl border border-[#E5E2DC] bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Bezahlt</div>
          <div className="font-serif text-[24px] font-medium text-[#154226]">{formatCurrency(totalPaidCents)}</div>
          <div className="text-[11px] text-[#9CA3AF]">{(invoices ?? []).filter((i) => i.status === 'paid').length} Rechnungen</div>
        </div>
        <div className="rounded-xl border border-[#E5E2DC] bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Offen</div>
          <div className="font-serif text-[24px] font-medium text-[#F59E0B]">{formatCurrency(openCents)}</div>
          <div className="text-[11px] text-[#9CA3AF]">{(invoices ?? []).filter((i) => i.status !== 'paid' && i.status !== 'cancelled').length} Rechnungen</div>
        </div>
        <div className="rounded-xl border border-[#E5E2DC] bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Überfällig</div>
          <div className="font-serif text-[24px] font-medium text-[#EF4444]">{formatCurrency(overdueCents)}</div>
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
      <div className="overflow-hidden rounded-xl border border-[#E5E2DC] bg-white shadow-sm">
        <div className="grid grid-cols-[48px_130px_1fr_110px_100px_80px] gap-3 border-b-2 border-[#E5E2DC] bg-black/[0.02] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] md:grid-cols-[48px_130px_1fr_140px_110px_100px_80px]">
          <div />
          <div>Rechnung</div>
          <div>Leistung</div>
          <div className="text-right">Betrag</div>
          <div className="text-center">Status</div>
          <div className="text-right">Optionen</div>
        </div>
        {(invoices ?? []).length === 0 ? (
          <div className="px-6 py-16 text-center text-[14px] text-[#6B7280]">
            Noch keine Rechnungen für diesen Kunden. <Link href={`/invoices/new?customerId=${customerId}`} className="text-[#154226] hover:underline">Neue Rechnung anlegen</Link>
          </div>
        ) : (
          <CustomerInvoiceTableRows
            rows={(invoices ?? []).map((inv) => {
              const info = itemsByInvoice.get(inv.id)
              const totalCents = info?.totalCents ?? 0
              const firstDesc = info?.description ?? '–'
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
        )}
      </div>
    </main>
  )
}
