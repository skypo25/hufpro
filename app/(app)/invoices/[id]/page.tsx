import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { fetchInvoicePdfData } from '@/lib/pdf/invoiceData'
import InvoiceDetailView from '@/components/invoices/InvoiceDetailView'

type InvoiceDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const data = await fetchInvoicePdfData(supabase, user.id, id)
  if (!data) notFound()

  const { data: invRow } = await supabase
    .from('invoices')
    .select('customer_id, status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  const status = (invRow as { status?: string } | null)?.status ?? 'draft'
  if (status === 'draft') {
    redirect(`/invoices/${id}/edit`)
  }

  const customerId = (invRow as { customer_id?: string } | null)?.customer_id
  const backHref = customerId ? `/customers/${customerId}/invoices` : '/customers'

  return <InvoiceDetailView data={data} backHref={backHref} invoiceId={id} status={status} />
}
