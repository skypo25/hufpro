import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { requireEnv } from '@/lib/env'
import { getStripe } from '@/lib/stripe/stripe'
import { sendDirectoryProductEmail } from '@/lib/directory/onboarding/sendDirectoryProductEmails.server'
import { syncDirectoryProfilePlanFromEntitlements } from '@/lib/directory/product/syncDirectoryProfilePlanFromEntitlements.server'
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

async function applyDirectoryTopProfileFromCheckout(args: {
  supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient>
  userId: string
  directoryProfileId: string
  durationDays: number
}): Promise<void> {
  const { data: prof, error: profErr } = await args.supabaseAdmin
    .from('directory_profiles')
    .select('id, claimed_by_user_id')
    .eq('id', args.directoryProfileId)
    .maybeSingle()

  if (profErr || !prof) return
  const owner = (prof as { claimed_by_user_id?: string | null }).claimed_by_user_id ?? null
  if (owner !== args.userId) return

  const now = Date.now()
  const addMs = Math.max(1, Math.floor(args.durationDays)) * 86400000

  // Extend (or create) directory_subscription entitlement.
  const { data: ent } = await args.supabaseAdmin
    .from('directory_profile_top_entitlements')
    .select('active_until')
    .eq('directory_profile_id', args.directoryProfileId)
    .eq('source', 'directory_subscription')
    .maybeSingle()

  const existingUntilIso = (ent as { active_until?: string | null } | null)?.active_until ?? null
  const existingUntilMs = existingUntilIso ? new Date(existingUntilIso).getTime() : NaN
  const baseMs = Number.isFinite(existingUntilMs) && existingUntilMs > now ? existingUntilMs : now
  const nextUntilIso = new Date(baseMs + addMs).toISOString()

  await args.supabaseAdmin
    .from('directory_profile_top_entitlements')
    .upsert(
      {
        directory_profile_id: args.directoryProfileId,
        source: 'directory_subscription',
        active_until: nextUntilIso,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'directory_profile_id,source' }
    )

  await syncDirectoryProfilePlanFromEntitlements(args.supabaseAdmin, args.directoryProfileId)
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
    const directoryProfileId = session.metadata?.directory_profile_id?.toString() || null
    const topDaysRaw = session.metadata?.directory_top_profile_days?.toString() || null
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

    if (directoryProfileId) {
      const durationDays = topDaysRaw ? Number(topDaysRaw) : NaN
      if (Number.isFinite(durationDays) && durationDays > 0) {
        await applyDirectoryTopProfileFromCheckout({
          supabaseAdmin,
          userId,
          directoryProfileId,
          durationDays,
        })
      }
    }

    const transactionalSlug = session.metadata?.directory_profile_slug?.toString().trim() || ''
    const transactionalKind = session.metadata?.directory_transactional_email?.toString().trim() || ''
    if (
      transactionalSlug &&
      (transactionalKind === 'directory_premium_checkout_done' || transactionalKind === 'app_checkout_done')
    ) {
      const kind =
        transactionalKind === 'app_checkout_done' ? 'app_checkout_done' : 'directory_premium_checkout_done'
      await sendDirectoryProductEmail({
        db: supabaseAdmin,
        userId,
        profileSlug: transactionalSlug,
        kind,
      })
    }

    await supabaseAdmin
      .from('stripe_webhook_events')
      .update({ user_id: userId })
      .eq('event_id', event.id)
  }

  const handleSubscription = async (sub: Stripe.Subscription) => {
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
    const userId = await resolveUserIdForCustomer({ supabaseAdmin, stripeCustomerId: customerId })
    if (!userId) return

    const appMonthlyPriceId = process.env.STRIPE_PRICE_ID_MONTHLY?.trim() || null
    const directoryPremiumMonthlyPriceId = process.env.STRIPE_PRICE_ID_DIRECTORY_PREMIUM_MONTHLY?.trim() || null
    const directoryPremiumTop30PriceId = process.env.STRIPE_PRICE_ID_DIRECTORY_TOP_PROFILE_30D?.trim() || null
    const itemPriceIds = sub.items.data
      .map((it) => it.price?.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
    /** Nur das App-Monatsabo soll app_subscription setzen/löschen — nicht andere Stripe-Subscriptions desselben Customers. */
    const isAppMonthlySubscription =
      !appMonthlyPriceId || itemPriceIds.includes(appMonthlyPriceId)
    const isDirectoryPremiumSubscription =
      (!!directoryPremiumMonthlyPriceId && itemPriceIds.includes(directoryPremiumMonthlyPriceId)) ||
      (!!directoryPremiumTop30PriceId && itemPriceIds.includes(directoryPremiumTop30PriceId))

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

    // App-Subscription => Top-Profil automatisch aktiv (Quelle: app_subscription)
    if (isAppMonthlySubscription) {
      const st2 = (sub.status ?? '').toString()
      if (st2 === 'active' || st2 === 'trialing' || st2 === 'past_due') {
        const { data: ownedProfiles } = await supabaseAdmin
          .from('directory_profiles')
          .select('id')
          .eq('claimed_by_user_id', userId)

        const untilIso = asIsoSeconds(sub.current_period_end) ?? null
        const rows =
          (ownedProfiles as { id: string }[] | null | undefined)?.map((p) => ({
            directory_profile_id: p.id,
            source: 'app_subscription',
            active_until: untilIso,
            updated_at: nowIso,
          })) ?? []

        if (rows.length > 0) {
          await supabaseAdmin
            .from('directory_profile_top_entitlements')
            .upsert(rows, { onConflict: 'directory_profile_id,source' })
        }
      } else {
        // Subscription nicht live => app_subscription entitlement entfernen
        const { data: ownedProfiles } = await supabaseAdmin
          .from('directory_profiles')
          .select('id')
          .eq('claimed_by_user_id', userId)
        const ids = (ownedProfiles as { id: string }[] | null | undefined)?.map((p) => p.id) ?? []
        if (ids.length > 0) {
          await supabaseAdmin
            .from('directory_profile_top_entitlements')
            .delete()
            .in('directory_profile_id', ids)
            .eq('source', 'app_subscription')
        }
      }
    }

    // Verzeichnis-Premium (eigenes Monatsabo, 9,95 €) => Quelle directory_subscription
    if (isDirectoryPremiumSubscription) {
      const st3 = (sub.status ?? '').toString()
      if (st3 === 'active' || st3 === 'trialing' || st3 === 'past_due') {
        const { data: ownedProfiles } = await supabaseAdmin
          .from('directory_profiles')
          .select('id')
          .eq('claimed_by_user_id', userId)

        const untilIso = asIsoSeconds(sub.current_period_end) ?? null
        const rowsDir =
          (ownedProfiles as { id: string }[] | null | undefined)?.map((p) => ({
            directory_profile_id: p.id,
            source: 'directory_subscription',
            active_until: untilIso,
            updated_at: nowIso,
          })) ?? []

        if (rowsDir.length > 0) {
          await supabaseAdmin
            .from('directory_profile_top_entitlements')
            .upsert(rowsDir, { onConflict: 'directory_profile_id,source' })
        }
      } else {
        const { data: ownedProfiles } = await supabaseAdmin
          .from('directory_profiles')
          .select('id')
          .eq('claimed_by_user_id', userId)
        const ids = (ownedProfiles as { id: string }[] | null | undefined)?.map((p) => p.id) ?? []
        if (ids.length > 0) {
          await supabaseAdmin
            .from('directory_profile_top_entitlements')
            .delete()
            .in('directory_profile_id', ids)
            .eq('source', 'directory_subscription')
        }
      }
    }

    const { data: ownedForSync } = await supabaseAdmin
      .from('directory_profiles')
      .select('id')
      .eq('claimed_by_user_id', userId)
    for (const row of (ownedForSync as { id: string }[] | null | undefined) ?? []) {
      await syncDirectoryProfilePlanFromEntitlements(supabaseAdmin, row.id)
    }

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

