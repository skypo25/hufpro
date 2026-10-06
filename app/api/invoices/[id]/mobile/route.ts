import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { fetchInvoicePdfData } from '@/lib/pdf/invoiceData'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await fetchInvoicePdfData(supabase, user.id, id)
  if (!data) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const { data: invRow } = await supabase
    .from('invoices')
    .select('customer_id, status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  const status = (invRow as { status?: string } | null)?.status ?? 'draft'
  if (status === 'draft') {
    return NextResponse.json({ redirectTo: `/invoices/${id}/edit` })
  }

  return NextResponse.json({
    data,
    status,
    customerId: (invRow as { customer_id?: string } | null)?.customer_id ?? null,
  })
}
