import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { BILLING_ACCOUNT_COLUMNS } from '@/lib/billing/billingAccountSelect'
import { getBillingState, canAccessApp } from '@/lib/billing/state'
import type { BillingAccountRow } from '@/lib/billing/types'
import { buildUserDataExportZip } from '@/lib/export/buildUserExportZip'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  const { data: row, error } = await supabase
    .from('billing_accounts')
    .select(BILLING_ACCOUNT_COLUMNS)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Billing-Status konnte nicht geladen werden.' }, { status: 500 })
  }

  const state = getBillingState({
    account: (row as BillingAccountRow | null) ?? null,
    priceIdMonthly: process.env.STRIPE_PRICE_ID_MONTHLY?.trim() || null,
  })

  if (!canAccessApp(state)) {
    return NextResponse.json({ error: 'Kein Zugriff auf den Export.' }, { status: 403 })
  }

  try {
    const buf = await buildUserDataExportZip(user.id)
    const day = new Date().toISOString().slice(0, 10)
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="anidocs-export-${day}.zip"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Export fehlgeschlagen.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
