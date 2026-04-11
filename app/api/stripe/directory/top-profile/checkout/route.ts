import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { requireEnv } from '@/lib/env'
import { getAppUrl, getStripe } from '@/lib/stripe/stripe'

type Body = {
  directoryProfileId?: string
}

const TOP_PROFILE_DURATION_DAYS = 30

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as Body
  const directoryProfileId = body.directoryProfileId?.toString().trim() || ''
  if (!directoryProfileId) {
    return NextResponse.json({ error: 'directoryProfileId fehlt.' }, { status: 400 })
  }

  // Nur beanspruchte Profile dürfen "Top Profil" kaufen.
  const { data: prof, error: profErr } = await supabase
    .from('directory_profiles')
    .select('id, claimed_by_user_id, listing_status')
    .eq('id', directoryProfileId)
    .maybeSingle()

  if (profErr) {
    return NextResponse.json({ error: 'Profil konnte nicht geladen werden.' }, { status: 500 })
  }
  if (!prof || (prof as { claimed_by_user_id?: string | null }).claimed_by_user_id !== user.id) {
    return NextResponse.json({ error: 'Kein Zugriff auf dieses Profil.' }, { status: 403 })
  }

  const priceId = requireEnv('STRIPE_PRICE_ID_DIRECTORY_TOP_PROFILE_30D')
  const appUrl = getAppUrl()
  const stripe = getStripe()

  // Reuse existing Stripe customer if present (optional).
  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: accountRow } = await supabaseAdmin
    .from('billing_accounts')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()
  const existingCustomerId = (accountRow?.stripe_customer_id as string | null | undefined) ?? null

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: existingCustomerId ?? undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/directory/mein-profil?top=success`,
    cancel_url: `${appUrl}/directory/mein-profil?top=canceled`,
    metadata: {
      supabase_user_id: user.id,
      directory_profile_id: directoryProfileId,
      directory_top_profile_days: String(TOP_PROFILE_DURATION_DAYS),
      directory_top_profile_kind: 'top_profile_v1',
    },
  })

  if (!session.url) {
    return NextResponse.json({ error: 'Checkout konnte nicht gestartet werden.' }, { status: 500 })
  }

  return NextResponse.json({ url: session.url })
}

