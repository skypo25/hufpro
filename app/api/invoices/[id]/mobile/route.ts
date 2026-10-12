import { NextResponse } from 'next/server'
import { fetchInvoicePdfData } from '@/lib/pdf/invoiceData'
import { getSupabaseAndUser } from '@/lib/supabase-auth'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Cookie (PWA) + Bearer (Flutter)
  const { user, supabase } = await getSupabaseAndUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }

  const data = await fetchInvoicePdfData(supabase, user.id, id)
  if (!data) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const { data: invRow } = await supabase
    .from('invoices')
    .select('customer_id, status, zugferd_enabled')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  const status = (invRow as { status?: string } | null)?.status ?? 'draft'

  // Flutter: immer Vorschau-Daten; kein Redirect (PWA-Edit-Link).
  return NextResponse.json({
    data,
    status,
    customerId: (invRow as { customer_id?: string } | null)?.customer_id ?? null,
    zugferdEnabled:
      (invRow as { zugferd_enabled?: boolean } | null)?.zugferd_enabled === true,
  })
}
