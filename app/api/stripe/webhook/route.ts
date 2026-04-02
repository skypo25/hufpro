import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { requireEnv } from '@/lib/env'
import { getStripe } from '@/lib/stripe/stripe'
import type Stripe from 'stripe'

type BillingUpdate = {
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  subscription_status?: string | null
  subscription_price_id?: string | null
  subscription_current_period_end?: string | null
  subscription_cancel_at_period_end?: boolean
  subscription_cancel_at?: string | null
  trial_ends_at?: string | null
  post_cancel_access_until?: string | null
  billing_email?: string | null
  last_stripe_event_at?: string | null
  updated_at?: string
}

function asIsoSeconds(s: number | null | undefined): string | null {
  if (!s) return null
  const d = new Date(s * 1000)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

async function resolveUserIdForCustomer(args: {
  supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient>
  stripeCustomerId: string
}): Promise<string | null> {
  const { data } = await args.supabaseAdmin
    .from('billing_accounts')
    .select('user_id')
    .eq('stripe_customer_id', args.stripeCustomerId)
    .maybeSingle()
  return (data?.user_id as string | null) ?? null
}

async function applyBillingUpdate(args: {
  supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient>
  userId: string
  patch: BillingUpdate
}): Promise<void> {
  const patch: BillingUpdate = {
    ...args.patch,
    updated_at: new Date().toISOString(),
  }
  const { error } = await args.supabaseAdmin.from('billing_accounts').upsert(
    { user_id: args.userId, ...patch },
    { onConflict: 'user_id' }
  )
  if (error) {
    throw new Error('billing_accounts upsert failed')
  }
}

export async function POST(request: Request) {
  const stripe = getStripe()
  const secret = requireEnv('STRIPE_WEBHOOK_SECRET')

  const sig = (await headers()).get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }

  const payload = await request.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(payload, sig, secret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const { error: idempoErr } = await supabaseAdmin
    .from('stripe_webhook_events')
    .insert({
      event_id: event.id,
      event_type: event.type,
      stripe_created_at: asIsoSeconds(event.created) ?? null,
      livemode: event.livemode ?? null,
    })

  if (idempoErr && (idempoErr as { code?: string }).code === '23505') {
    return NextResponse.json({ received: true })
  }
  if (idempoErr) {
    return NextResponse.json({ error: 'Idempotency insert failed' }, { status: 500 })
  }

  const nowIso = new Date().toISOString()

  const handleCheckoutCompleted = async (session: Stripe.Checkout.Session) => {
    const userId = session.metadata?.supabase_user_id?.toString() || null
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id ?? null
    const email =
      session.customer_details?.email ??
      session.customer_email ??
      (typeof session.customer !== 'string' ? session.customer?.email ?? null : null)

    if (!userId) return

    await applyBillingUpdate({
      supabaseAdmin,
      userId,
      patch: {
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        billing_email: email ?? null,
        last_stripe_event_at: nowIso,
      },
    })

    await supabaseAdmin
      .from('stripe_webhook_events')
      .update({ user_id: userId })
      .eq('event_id', event.id)
  }

  const handleSubscription = async (sub: Stripe.Subscription) => {
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
    const userId = await resolveUserIdForCustomer({ supabaseAdmin, stripeCustomerId: customerId })
    if (!userId) return

    const priceId = sub.items.data[0]?.price?.id ?? null
    const st = (sub.status ?? '').toString()
    /** Nach Kündigung: 10 Tage nur Lesen + Export (ab Periodenende bzw. jetzt). */
    let postCancelAccessUntil: string | null | undefined
    if (st === 'canceled') {
      const periodEndSec = sub.current_period_end
      const baseMs = periodEndSec ? Math.max(Date.now(), periodEndSec * 1000) : Date.now()
      postCancelAccessUntil = new Date(baseMs + 10 * 24 * 60 * 60 * 1000).toISOString()
    } else if (st === 'active' || st === 'trialing') {
      postCancelAccessUntil = null
    }

    await applyBillingUpdate({
      supabaseAdmin,
      userId,
      patch: {
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        subscription_status: sub.status ?? null,
        subscription_price_id: priceId,
        subscription_current_period_end: asIsoSeconds(sub.current_period_end) ?? null,
        subscription_cancel_at_period_end: sub.cancel_at_period_end ?? false,
        subscription_cancel_at: asIsoSeconds(sub.cancel_at) ?? null,
        trial_ends_at: asIsoSeconds(sub.trial_end) ?? null,
        ...(postCancelAccessUntil !== undefined ? { post_cancel_access_until: postCancelAccessUntil } : {}),
        last_stripe_event_at: nowIso,
      },
    })

    await supabaseAdmin
      .from('stripe_webhook_events')
      .update({ user_id: userId })
      .eq('event_id', event.id)
  }

  const handleInvoicePaid = async (inv: Stripe.Invoice, paid: boolean) => {
    const customerId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id ?? null
    if (!customerId) return
    const userId = await resolveUserIdForCustomer({ supabaseAdmin, stripeCustomerId: customerId })
    if (!userId) return

    const status = paid ? 'active' : 'past_due'
    await applyBillingUpdate({
      supabaseAdmin,
      userId,
      patch: {
        stripe_customer_id: customerId,
        stripe_subscription_id: (typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id) ?? null,
        subscription_status: status,
        last_stripe_event_at: nowIso,
      },
    })

    await supabaseAdmin
      .from('stripe_webhook_events')
      .update({ user_id: userId })
      .eq('event_id', event.id)
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscription(event.data.object as Stripe.Subscription)
        break
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice, true)
        break
      case 'invoice.payment_failed':
        await handleInvoicePaid(event.data.object as Stripe.Invoice, false)
        break
      default:
        break
    }
  } catch {
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

