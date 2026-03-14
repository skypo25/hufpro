import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faFileInvoice } from '@fortawesome/free-solid-svg-icons'
import InvoiceListRowWithMenu from '@/components/invoices/InvoiceListRowWithMenu'

export default async function InvoicesPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, invoice_date, status, customer_id')
    .eq('user_id', user.id)
    .order('invoice_date', { ascending: false })
    .limit(50)

  const customerIds = [...new Set((invoices ?? []).map((i) => i.customer_id).filter(Boolean))]
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
        <Link href="/dashboard" className="text-[#154226] hover:underline">Dashboard</Link>
        <span aria-hidden>›</span>
        <span className="text-[#6B7280]">Rechnungen</span>
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-[28px] font-medium tracking-tight text-[#1B1F23]">Rechnungen</h1>
          <p className="mt-1 text-[14px] text-[#6B7280]">Rechnungen erstellen und verwalten</p>
        </div>
        <Link
          href="/invoices/new"
          className="huf-btn-dark inline-flex items-center gap-2 rounded-lg bg-[#154226] px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-[#0f301b]"
        >
          <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
          Neue Rechnung
        </Link>
      </div>

      <div className="rounded-xl border border-[#E5E2DC] bg-white shadow-sm">
        {!invoices?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf3ef] text-2xl text-[#154226]">
              <FontAwesomeIcon icon={faFileInvoice} />
            </div>
            <p className="text-[15px] font-medium text-[#1B1F23]">Noch keine Rechnungen</p>
            <p className="mt-1 text-[14px] text-[#6B7280]">Erstelle deine erste Rechnung für einen Kunden.</p>
            <Link
              href="/invoices/new"
              className="huf-btn-dark mt-6 inline-flex items-center gap-2 rounded-lg bg-[#154226] px-4 py-2.5 text-[14px] font-medium text-white hover:bg-[#0f301b]"
            >
              <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
              Neue Rechnung erstellen
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-[#E5E2DC]">
            {(invoices ?? []).map((inv) => (
              <InvoiceListRowWithMenu
                key={inv.id}
                id={inv.id}
                invoiceNumber={inv.invoice_number}
                customerName={inv.customer_id ? customerNames[inv.customer_id] ?? 'Kunde' : '–'}
                invoiceDate={inv.invoice_date}
                status={inv.status}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
