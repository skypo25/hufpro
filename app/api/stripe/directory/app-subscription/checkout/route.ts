import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { ensureBillingAccountRow } from '@/lib/billing/supabaseBilling'
import type { BillingAccountRow } from '@/lib/billing/types'
import { requireEnv } from '@/lib/env'
import { getAppUrl, getStripe } from '@/lib/stripe/stripe'

type Body = {
  directoryProfileId?: string
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as Body
  const directoryProfileIdRaw = body.directoryProfileId?.toString().trim() || ''

  let slug: string | null = null
  if (directoryProfileIdRaw) {
    const { data: prof } = await supabase
      .from('directory_profiles')
      .select('slug, claimed_by_user_id')
      .eq('id', directoryProfileIdRaw)
      .maybeSingle()
    if (
      prof &&
      (prof as { claimed_by_user_id?: string | null }).claimed_by_user_id === user.id &&
      (prof as { slug?: string }).slug
    ) {
      slug = (prof as { slug: string }).slug
    }
  }
  if (!slug) {
    const { data: first } = await supabase
      .from('directory_profiles')
      .select('slug')
      .eq('claimed_by_user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    slug = (first as { slug?: string } | null)?.slug ?? null
  }
  if (!slug) {
    return NextResponse.json({ error: 'Kein Verzeichnisprofil für dieses Konto.' }, { status: 400 })
  }

  await ensureBillingAccountRow({ userId: user.id, email: user.email })

  const priceId = requireEnv('STRIPE_PRICE_ID_MONTHLY')
  const appUrl = getAppUrl()
  const stripe = getStripe()

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: accountRow, error: accErr } = await supabaseAdmin
    .from('billing_accounts')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (accErr) {
    return NextResponse.json({ error: 'Billing-Konto konnte nicht geladen werden.' }, { status: 500 })
  }

  const account = (accountRow as BillingAccountRow | null) ?? null

  let customerId = account?.stripe_customer_id ?? null
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id

    const { error: upErr } = await supabaseAdmin
      .from('billing_accounts')
      .update({
        stripe_customer_id: customerId,
        billing_email: user.email ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
    if (upErr) {
      return NextResponse.json({ error: 'Stripe-Kunde konnte nicht gespeichert werden.' }, { status: 500 })
    }
  }

  const trialEndsAt = account?.trial_ends_at ? new Date(account.trial_ends_at) : null
  const now = Date.now()
  const trialEndUnix =
    trialEndsAt && !Number.isNaN(trialEndsAt.getTime()) && trialEndsAt.getTime() > now + 60_000
      ? Math.floor(trialEndsAt.getTime() / 1000)
      : undefined

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/directory/mein-profil?app_sub=success`,
    cancel_url: `${appUrl}/directory/mein-profil?app_sub=canceled`,
    subscription_data: trialEndUnix ? { trial_end: trialEndUnix } : undefined,
    metadata: {
      supabase_user_id: user.id,
      directory_profile_slug: slug,
      directory_transactional_email: 'app_checkout_done',
    },
  })

  if (!session.url) {
    return NextResponse.json({ error: 'Checkout konnte nicht gestartet werden.' }, { status: 500 })
  }

  return NextResponse.json({ url: session.url })
}
