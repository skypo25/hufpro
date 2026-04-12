import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { ensureBillingAccountRow } from '@/lib/billing/supabaseBilling'
import type { BillingAccountRow } from '@/lib/billing/types'
import { getOptionalEnv } from '@/lib/env'
import { getAppUrl, getStripe } from '@/lib/stripe/stripe'

/** Nur bei einmaligem Preis (`mode: payment`): Laufzeit für Entitlement bis Webhook. */
const PREMIUM_PAYMENT_DURATION_DAYS = 30

type Body = {
  directoryProfileId?: string
  /** Nach erfolgreicher Zahlung zurück in den Verzeichnis-Wizard (Schritt Logo/Galerie), sonst Mein Profil. */
  successReturnToWizard?: boolean
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
  const directoryProfileId = body.directoryProfileId?.toString().trim() || ''
  const returnToWizard = body.successReturnToWizard === true
  if (!directoryProfileId) {
    return NextResponse.json({ error: 'directoryProfileId fehlt.' }, { status: 400 })
  }

  const { data: prof, error: profErr } = await supabase
    .from('directory_profiles')
    .select('id, claimed_by_user_id, slug')
    .eq('id', directoryProfileId)
    .maybeSingle()

  if (profErr) {
    return NextResponse.json({ error: 'Profil konnte nicht geladen werden.' }, { status: 500 })
  }
  if (!prof || (prof as { claimed_by_user_id?: string | null }).claimed_by_user_id !== user.id) {
    return NextResponse.json({ error: 'Kein Zugriff auf dieses Profil.' }, { status: 403 })
  }

  const slug = (prof as { slug: string }).slug

  try {
    await ensureBillingAccountRow({ userId: user.id, email: user.email })

    const priceMonthly = getOptionalEnv('STRIPE_PRICE_ID_DIRECTORY_PREMIUM_MONTHLY')?.trim() || ''
    const priceTop30 = getOptionalEnv('STRIPE_PRICE_ID_DIRECTORY_TOP_PROFILE_30D')?.trim() || ''
    const useSubscription = Boolean(priceMonthly)
    const priceId = priceMonthly || priceTop30
    if (!priceId) {
      return NextResponse.json(
        {
          error:
            'Kein Stripe-Preis: STRIPE_PRICE_ID_DIRECTORY_PREMIUM_MONTHLY (Abo) oder STRIPE_PRICE_ID_DIRECTORY_TOP_PROFILE_30D (einmalig oder wiederkehrend) setzen.',
        },
        { status: 400 },
      )
    }

    const appUrl = getAppUrl()
    const stripe = getStripe()

    /** Abo-Checkout: Monatsabo-Env oder Fallback-Preis ist in Stripe als recurring angelegt. */
    let useSubscriptionCheckout = useSubscription
    if (!useSubscriptionCheckout) {
      const priceObj = await stripe.prices.retrieve(priceId)
      useSubscriptionCheckout = Boolean(priceObj.recurring)
    }

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

    const wizardBase = `${appUrl}/behandler/profil/erstellen?paket=premium`
    const successUrl = returnToWizard
      ? `${wizardBase}&premium_sub=success`
      : `${appUrl}/directory/mein-profil?premium_sub=success`
    const cancelUrl = returnToWizard
      ? `${wizardBase}&premium_sub=canceled`
      : `${appUrl}/directory/mein-profil?premium_sub=canceled`

    let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>
    if (useSubscriptionCheckout) {
      const trialEndsAt = account?.trial_ends_at ? new Date(account.trial_ends_at) : null
      const now = Date.now()
      const trialEndUnix =
        trialEndsAt && !Number.isNaN(trialEndsAt.getTime()) && trialEndsAt.getTime() > now + 60_000
          ? Math.floor(trialEndsAt.getTime() / 1000)
          : undefined
      session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        subscription_data: trialEndUnix ? { trial_end: trialEndUnix } : undefined,
        metadata: {
          supabase_user_id: user.id,
          directory_profile_id: directoryProfileId,
          directory_profile_slug: slug,
          directory_transactional_email: 'directory_premium_checkout_done',
        },
      })
    } else {
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer: customerId ?? undefined,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          supabase_user_id: user.id,
          directory_profile_id: directoryProfileId,
          directory_profile_slug: slug,
          directory_transactional_email: 'directory_premium_checkout_done',
          directory_top_profile_days: String(PREMIUM_PAYMENT_DURATION_DAYS),
          directory_top_profile_kind: 'directory_premium_one_shot',
        },
      })
    }

    if (!session.url) {
      return NextResponse.json({ error: 'Checkout konnte nicht gestartet werden.' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Stripe-Checkout fehlgeschlagen.'
    console.error('[directory premium checkout]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
