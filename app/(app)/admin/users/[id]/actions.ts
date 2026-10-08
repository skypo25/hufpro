'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { requireAdmin } from '@/lib/admin/requireAdmin'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { logAdminAuditEvent } from '@/lib/admin/audit'
import { getStripe } from '@/lib/stripe/stripe'
import { listLiveSubscriptions } from '@/lib/billing/stripeSubscriptionExclusive.server'
import { syncBillingSubscriptionFromStripeForUser } from '@/lib/billing/syncSubscriptionFromStripe.server'
import { createAndSendPasswordResetForUserId } from '@/lib/auth/passwordReset.server'
import { isFeatureEnabled, type AdminFeatureFlagKey } from '@/lib/admin/featureFlagsShared'
import { IMPERSONATION_COOKIE } from '@/lib/admin/impersonation'

function backTo(userId: string, q: Record<string, string> = {}) {
  const p = new URLSearchParams(q)
  const qs = p.toString()
  return `/admin/users/${userId}${qs ? `?${qs}` : ''}`
}

function safeErr(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.slice(0, 180)
}

function readUserId(formData: FormData): string {
  return String(formData.get('userId') ?? '').trim()
}

export async function saveAdminUserNote(formData: FormData) {
  const userId = readUserId(formData)
  if (!userId) redirect('/admin/users?err=note')
  const admin = await requireAdmin()
  const db = createSupabaseServiceRoleClient()
  const noteRaw = String(formData.get('admin_note') ?? '')
  const note = noteRaw.trim().slice(0, 10_000)

  const payload = {
    user_id: userId,
    admin_note: note || null,
    updated_at: new Date().toISOString(),
    updated_by: admin.userId,
  }

  const { error } = await db.from('admin_user_meta').upsert(payload, { onConflict: 'user_id' })
  if (error) {
    redirect(backTo(userId, { err: 'note', msg: safeErr(error.message) }))
  }

  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: userId,
    action: 'admin_note.save',
    message: note ? 'note_set' : 'note_cleared',
    metadata: { length: note.length },
  })

  revalidatePath(`/admin/users/${userId}`)
  redirect(backTo(userId, { saved: 'note' }))
}

export async function toggleAdminUserFlag(formData: FormData) {
  const userId = readUserId(formData)
  if (!userId) redirect('/admin/users?err=flag')
  const admin = await requireAdmin()
  const db = createSupabaseServiceRoleClient()
  const key = String(formData.get('flag') ?? '').trim()
  if (!key) redirect(backTo(userId, { err: 'flag' }))

  const rowRes = await db
    .from('admin_user_meta')
    .select('feature_flags')
    .eq('user_id', userId)
    .maybeSingle()
  if (rowRes.error) {
    redirect(backTo(userId, { err: 'flag', msg: safeErr(rowRes.error.message) }))
  }
  const row = rowRes.data ?? null

  const flags = ((row?.feature_flags ?? {}) as Record<string, unknown>) || {}
  const keyTyped = key as AdminFeatureFlagKey
  const currentlyOn = isFeatureEnabled(flags, keyTyped)
  const next = !currentlyOn
  flags[key] = next

  const { error } = await db.from('admin_user_meta').upsert(
    {
      user_id: userId,
      feature_flags: flags,
      updated_at: new Date().toISOString(),
      updated_by: admin.userId,
    },
    { onConflict: 'user_id' }
  )
  if (error) redirect(backTo(userId, { err: 'flag', msg: safeErr(error.message) }))

  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: userId,
    action: 'feature_flag.toggle',
    metadata: { flag: key, value: next },
  })

  revalidatePath(`/admin/users/${userId}`)
  redirect(backTo(userId, { saved: 'flag' }))
}

export async function extendTrial(formData: FormData) {
  const userId = readUserId(formData)
  if (!userId) redirect('/admin/users?err=trial')
  const admin = await requireAdmin()
  const db = createSupabaseServiceRoleClient()
  const days = Number(formData.get('days') ?? 0)
  const addDays = Number.isFinite(days) ? Math.max(1, Math.min(60, Math.floor(days))) : 7
  const now = new Date()

  const { data: bill } = await db
    .from('billing_accounts')
    .select('trial_ends_at')
    .eq('user_id', userId)
    .maybeSingle()

  const current = bill?.trial_ends_at ? new Date(String(bill.trial_ends_at)) : null
  const base = current && !Number.isNaN(current.getTime()) && current.getTime() > now.getTime() ? current : now
  const next = new Date(base.getTime() + addDays * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await db
    .from('billing_accounts')
    .upsert({ user_id: userId, trial_ends_at: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) redirect(backTo(userId, { err: 'trial', msg: safeErr(error.message) }))

  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: userId,
    action: 'trial.extend',
    metadata: { addDays, next },
  })

  revalidatePath(`/admin/users/${userId}`)
  revalidatePath('/admin/users')
  revalidatePath('/admin')
  redirect(backTo(userId, { saved: 'trial' }))
}

function subscriptionTrialStillActive(sub: { status?: string | null; trial_end?: number | null }): boolean {
  const st = (sub.status ?? '').toString()
  const te = sub.trial_end
  const nowSec = Math.floor(Date.now() / 1000)
  if (st === 'trialing') return true
  if (typeof te === 'number' && te > nowSec) return true
  return false
}

export async function endTrialNow(formData: FormData) {
  const userId = String(formData.get('userId') ?? '').trim()
  if (!userId) {
    redirect('/admin/users?err=trial')
  }

  const admin = await requireAdmin()
  const db = createSupabaseServiceRoleClient()
  const nowIso = new Date().toISOString()

  const { data: bill } = await db
    .from('billing_accounts')
    .select('stripe_subscription_id, stripe_customer_id, subscription_status')
    .eq('user_id', userId)
    .maybeSingle()

  let stripeSubIdTouched: string | null = null
  let stripeUpdateAttempted = false

  const storedSubId = (bill?.stripe_subscription_id as string | null) ?? null
  const customerId = (bill?.stripe_customer_id as string | null) ?? null

  const resolveTargetSubscriptionId = async (
    stripe: ReturnType<typeof getStripe>
  ): Promise<string | null> => {
    if (customerId) {
      const list = await stripe.subscriptions.list({ customer: customerId, limit: 20 })
      const idStillValid = (id: string | null | undefined): string | null => {
        if (!id) return null
        const m = list.data.find((s) => s.id === id)
        if (!m) return null
        const st = (m.status ?? '').toString()
        if (st === 'canceled' || st === 'incomplete_expired') return null
        return id
      }
      const fromDb = idStillValid(storedSubId)
      if (fromDb) return fromDb

      const trialing = list.data.find((s) => (s.status ?? '').toString() === 'trialing')
      if (trialing?.id) return trialing.id

      const withFutureTrial = list.data.find((s) => subscriptionTrialStillActive(s))
      if (withFutureTrial?.id) return withFutureTrial.id

      return (
        list.data.find((s) => {
          const st = (s.status ?? '').toString()
          return st !== 'canceled' && st !== 'incomplete_expired'
        })?.id ?? null
      )
    }
    return storedSubId
  }

  if (storedSubId || customerId) {
    try {
      const stripe = getStripe()
      const targetSubId = await resolveTargetSubscriptionId(stripe)
      if (!targetSubId) {
        const { error } = await db
          .from('billing_accounts')
          .upsert({ user_id: userId, trial_ends_at: nowIso, updated_at: nowIso }, { onConflict: 'user_id' })
        if (error) redirect(backTo(userId, { err: 'trial', msg: safeErr(error.message) }))
        await logAdminAuditEvent({
          actorUserId: admin.userId,
          targetUserId: userId,
          action: 'trial.end_now',
          message: 'db_only_no_stripe_subscription',
          metadata: { at: nowIso, stripe_customer_id: customerId },
        })
        revalidatePath(`/admin/users/${userId}`)
        revalidatePath('/admin/users')
        revalidatePath('/admin')
        redirect(backTo(userId, { saved: 'trial_end_db', msg: 'stripe_sub_missing' }))
      }

      let sub = await stripe.subscriptions.retrieve(targetSubId)
      if (subscriptionTrialStillActive(sub)) {
        stripeUpdateAttempted = true
        // Stripe: Trial sofort beenden — 'now' ist laut Doku zuverlässiger als nur Unix-Sekunden.
        await stripe.subscriptions.update(targetSubId, { trial_end: 'now' })
        sub = await stripe.subscriptions.retrieve(targetSubId)
      }
      stripeSubIdTouched = targetSubId

      const trialEndUnix = (sub as unknown as { trial_end?: number | null }).trial_end
      const periodEndUnix = (sub as unknown as { current_period_end?: number | null }).current_period_end
      const trialEndIso = trialEndUnix ? new Date(trialEndUnix * 1000).toISOString() : nowIso

      const patch: Record<string, unknown> = {
        stripe_subscription_id: targetSubId,
        subscription_status: sub.status ?? null,
        trial_ends_at: trialEndIso,
        subscription_current_period_end: periodEndUnix
          ? new Date(periodEndUnix * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      }
      const { data: updatedRows, error: upErr } = await db
        .from('billing_accounts')
        .update(patch)
        .eq('user_id', userId)
        .select('user_id')
      if (upErr) redirect(backTo(userId, { err: 'trial', msg: safeErr(upErr.message) }))
      if (!updatedRows?.length) {
        redirect(backTo(userId, { err: 'trial', msg: 'Kein billing_accounts-Datensatz für diesen Nutzer.' }))
      }
    } catch (e) {
      redirect(backTo(userId, { err: 'trial', msg: `Stripe: ${safeErr(e)}` }))
    }
  } else {
    const { error } = await db
      .from('billing_accounts')
      .upsert({ user_id: userId, trial_ends_at: nowIso, updated_at: nowIso }, { onConflict: 'user_id' })
    if (error) redirect(backTo(userId, { err: 'trial', msg: safeErr(error.message) }))
  }

  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: userId,
    action: 'trial.end_now',
    metadata: {
      at: nowIso,
      stripe_subscription_id: stripeSubIdTouched ?? storedSubId,
      stripe_update_attempted: stripeUpdateAttempted,
    },
  })

  revalidatePath(`/admin/users/${userId}`)
  revalidatePath('/admin/users')
  revalidatePath('/admin')
  redirect(backTo(userId, { saved: 'trial_end' }))
}

export async function sendPasswordReset(formData: FormData) {
  const userId = readUserId(formData)
  if (!userId) redirect('/admin/users?err=password_reset')
  const admin = await requireAdmin()

  const result = await createAndSendPasswordResetForUserId(userId, {
    createdUserAgent: 'admin-support',
  })
  if (!result.ok) {
    redirect(backTo(userId, { err: 'password_reset', msg: safeErr(result.error) }))
  }

  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: userId,
    action: 'password_reset.admin_send',
  })

  revalidatePath(`/admin/users/${userId}`)
  redirect(backTo(userId, { saved: 'password_reset' }))
}

async function resolveLiveSubscriptionId(userId: string): Promise<{
  customerId: string | null
  subscriptionId: string | null
}> {
  const db = createSupabaseServiceRoleClient()
  const { data: bill } = await db
    .from('billing_accounts')
    .select('stripe_customer_id, stripe_subscription_id')
    .eq('user_id', userId)
    .maybeSingle()

  const customerId = (bill?.stripe_customer_id as string | null) ?? null
  const storedSubId = (bill?.stripe_subscription_id as string | null) ?? null
  if (!customerId && !storedSubId) return { customerId: null, subscriptionId: null }

  try {
    const stripe = getStripe()
    if (customerId) {
      const live = await listLiveSubscriptions(stripe, customerId)
      if (storedSubId && live.some((s) => s.id === storedSubId)) {
        return { customerId, subscriptionId: storedSubId }
      }
      return { customerId, subscriptionId: live[0]?.id ?? storedSubId }
    }
    return { customerId, subscriptionId: storedSubId }
  } catch {
    return { customerId, subscriptionId: storedSubId }
  }
}

/** Kündigung zum Periodenende (Stripe cancel_at_period_end). */
export async function cancelSubscriptionAtPeriodEnd(formData: FormData) {
  const userId = readUserId(formData)
  if (!userId) redirect('/admin/users?err=billing')
  const admin = await requireAdmin()
  const { subscriptionId } = await resolveLiveSubscriptionId(userId)
  if (!subscriptionId) {
    redirect(backTo(userId, { err: 'billing', msg: 'Keine aktive Stripe-Subscription.' }))
  }
  try {
    const stripe = getStripe()
    await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })
    await syncBillingSubscriptionFromStripeForUser(userId)
  } catch (e) {
    redirect(backTo(userId, { err: 'billing', msg: `Stripe: ${safeErr(e)}` }))
  }
  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: userId,
    action: 'billing.cancel_at_period_end',
    metadata: { subscriptionId },
  })
  revalidatePath(`/admin/users/${userId}`)
  revalidatePath('/admin/users')
  revalidatePath('/admin')
  redirect(backTo(userId, { saved: 'billing_cancel_period' }))
}

/** Sofortkündigung in Stripe. */
export async function cancelSubscriptionNow(formData: FormData) {
  const userId = readUserId(formData)
  if (!userId) redirect('/admin/users?err=billing')
  const admin = await requireAdmin()
  const { subscriptionId } = await resolveLiveSubscriptionId(userId)
  if (!subscriptionId) {
    redirect(backTo(userId, { err: 'billing', msg: 'Keine aktive Stripe-Subscription.' }))
  }
  try {
    const stripe = getStripe()
    await stripe.subscriptions.cancel(subscriptionId)
    await syncBillingSubscriptionFromStripeForUser(userId)
  } catch (e) {
    redirect(backTo(userId, { err: 'billing', msg: `Stripe: ${safeErr(e)}` }))
  }
  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: userId,
    action: 'billing.cancel_now',
    metadata: { subscriptionId },
  })
  revalidatePath(`/admin/users/${userId}`)
  revalidatePath('/admin/users')
  revalidatePath('/admin')
  redirect(backTo(userId, { saved: 'billing_cancel_now' }))
}

/** Widerruf der Periodenend-Kündigung. */
export async function reactivateSubscription(formData: FormData) {
  const userId = readUserId(formData)
  if (!userId) redirect('/admin/users?err=billing')
  const admin = await requireAdmin()
  const db = createSupabaseServiceRoleClient()
  const { data: bill } = await db
    .from('billing_accounts')
    .select('stripe_subscription_id, subscription_cancel_at_period_end')
    .eq('user_id', userId)
    .maybeSingle()
  const subscriptionId = (bill?.stripe_subscription_id as string | null) ?? null
  if (!subscriptionId) {
    redirect(backTo(userId, { err: 'billing', msg: 'Keine Subscription-ID.' }))
  }
  try {
    const stripe = getStripe()
    const sub = await stripe.subscriptions.retrieve(subscriptionId)
    if (sub.status === 'canceled') {
      redirect(
        backTo(userId, {
          err: 'billing',
          msg: 'Abo ist bereits beendet — Reaktivierung nur über neues Checkout/Stripe.',
        })
      )
    }
    await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false })
    await syncBillingSubscriptionFromStripeForUser(userId)
  } catch (e) {
    redirect(backTo(userId, { err: 'billing', msg: `Stripe: ${safeErr(e)}` }))
  }
  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: userId,
    action: 'billing.reactivate',
    metadata: { subscriptionId },
  })
  revalidatePath(`/admin/users/${userId}`)
  revalidatePath('/admin/users')
  redirect(backTo(userId, { saved: 'billing_reactivate' }))
}

/** Comp-/Grace-Zugangstage (DB: post_cancel_access_until). */
export async function grantCompAccessDays(formData: FormData) {
  const userId = readUserId(formData)
  if (!userId) redirect('/admin/users?err=billing')
  const admin = await requireAdmin()
  const days = Number(formData.get('days') ?? 0)
  const addDays = Number.isFinite(days) ? Math.max(1, Math.min(60, Math.floor(days))) : 7
  const db = createSupabaseServiceRoleClient()
  const now = new Date()

  const { data: bill } = await db
    .from('billing_accounts')
    .select('post_cancel_access_until')
    .eq('user_id', userId)
    .maybeSingle()

  const current = bill?.post_cancel_access_until ? new Date(String(bill.post_cancel_access_until)) : null
  const base =
    current && !Number.isNaN(current.getTime()) && current.getTime() > now.getTime() ? current : now
  const next = new Date(base.getTime() + addDays * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await db.from('billing_accounts').upsert(
    {
      user_id: userId,
      post_cancel_access_until: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (error) redirect(backTo(userId, { err: 'billing', msg: safeErr(error.message) }))

  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: userId,
    action: 'billing.comp_access',
    metadata: { addDays, next },
  })

  revalidatePath(`/admin/users/${userId}`)
  revalidatePath('/admin/users')
  redirect(backTo(userId, { saved: 'billing_comp' }))
}

export async function setUserBan(formData: FormData) {
  const userId = readUserId(formData)
  if (!userId) redirect('/admin/users?err=ban')
  const admin = await requireAdmin()
  if (admin.userId === userId) {
    redirect(backTo(userId, { err: 'ban', msg: 'Du kannst dich nicht selbst deaktivieren.' }))
  }
  const db = createSupabaseServiceRoleClient()
  const mode = String(formData.get('mode') ?? '').trim()
  const ban_duration = mode === 'ban' ? '876000h' : 'none'

  const { error } = await db.auth.admin.updateUserById(userId, { ban_duration })
  if (error) redirect(backTo(userId, { err: 'ban', msg: safeErr(error.message) }))

  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: userId,
    action: mode === 'ban' ? 'account.ban' : 'account.unban',
    metadata: { ban_duration },
  })

  revalidatePath(`/admin/users/${userId}`)
  revalidatePath('/admin/users')
  redirect(backTo(userId, { saved: mode === 'ban' ? 'ban' : 'unban' }))
}

export async function deleteUserAccount(formData: FormData) {
  const userId = readUserId(formData)
  if (!userId) redirect('/admin/users?err=delete')
  const admin = await requireAdmin()
  if (admin.userId === userId) {
    redirect(backTo(userId, { err: 'delete', msg: 'Du kannst dich nicht selbst löschen.' }))
  }
  const confirmText = String(formData.get('confirm') ?? '').trim()
  const confirmCheck = String(formData.get('confirm_check') ?? '') === 'on'
  if (!confirmCheck || confirmText !== userId) {
    redirect(
      backTo(userId, {
        err: 'delete',
        msg: 'Bestätigung fehlt. Bitte Checkbox aktivieren und die User-ID exakt eingeben.',
      })
    )
  }
  const db = createSupabaseServiceRoleClient()

  // Hard delete: Stripe → Directory → Storage → App-Daten → Auth-User.
  const chunk = <T,>(arr: T[], size: number) => {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
  }

  const { data: billRow } = await db
    .from('billing_accounts')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()
  const stripeCustomerId = (billRow?.stripe_customer_id as string | null) ?? null
  let stripeCleanup: string | null = null
  if (stripeCustomerId) {
    try {
      const stripe = getStripe()
      const live = await listLiveSubscriptions(stripe, stripeCustomerId)
      for (const sub of live) {
        try {
          await stripe.subscriptions.cancel(sub.id)
        } catch {
          /* already canceled */
        }
      }
      try {
        await stripe.customers.del(stripeCustomerId)
        stripeCleanup = 'customer_deleted'
      } catch {
        stripeCleanup = 'subs_canceled_customer_kept'
      }
    } catch (e) {
      stripeCleanup = `stripe_error:${safeErr(e)}`
    }
  }

  // directory_claims.claimant_user_id is ON DELETE RESTRICT — must clear first.
  await db.from('directory_claims').delete().eq('claimant_user_id', userId)
  await db
    .from('directory_profiles')
    .update({
      claimed_by_user_id: null,
      claim_state: 'unclaimed',
      updated_at: new Date().toISOString(),
    })
    .eq('claimed_by_user_id', userId)
  await db.from('directory_user_access').delete().eq('user_id', userId)

  try {
    const [hoof, docPhotos, horses] = await Promise.all([
      db.from('hoof_photos').select('file_path').eq('user_id', userId),
      db.from('documentation_photos').select('file_path').eq('user_id', userId),
      db
        .from('horses')
        .select('photo_whole_left_path, photo_whole_right_path')
        .eq('user_id', userId),
    ])
    const horsePaths = ((horses.data as any[] | null | undefined) ?? []).flatMap((r) => [
      String(r.photo_whole_left_path || ''),
      String(r.photo_whole_right_path || ''),
    ])
    const paths = [
      ...((hoof.data as any[] | null | undefined) ?? []).map((r) => String(r.file_path || '')).filter(Boolean),
      ...((docPhotos.data as any[] | null | undefined) ?? []).map((r) => String(r.file_path || '')).filter(Boolean),
      ...horsePaths.filter(Boolean),
    ]
    for (const part of chunk(Array.from(new Set(paths)), 100)) {
      await db.storage.from('hoof-photos').remove(part).catch(() => null)
    }
  } catch {
    // ignore
  }

  try {
    const bucket = db.storage.from('user-logos')
    const list = await bucket.list(userId, { limit: 1000 }).catch(() => null)
    const names = (list as any)?.data as Array<{ name: string }> | undefined
    const rm = (names ?? []).map((o) => `${userId}/${o.name}`)
    for (const part of chunk(rm, 100)) {
      await bucket.remove(part).catch(() => null)
    }
  } catch {
    // ignore
  }

  await Promise.allSettled([
    db.from('appointment_horses').delete().eq('user_id', userId),
    db.from('appointments').delete().eq('user_id', userId),
    db.from('hoof_photos').delete().eq('user_id', userId),
    db.from('documentation_photos').delete().eq('user_id', userId),
    db.from('hoof_records').delete().eq('user_id', userId),
    db.from('documentation_records').delete().eq('user_id', userId),
    db.from('horses').delete().eq('user_id', userId),
    db.from('invoices').delete().eq('user_id', userId),
    db.from('customers').delete().eq('user_id', userId),
    db.from('billing_accounts').delete().eq('user_id', userId),
    db.from('user_settings').delete().eq('user_id', userId),
    db.from('admin_user_meta').delete().eq('user_id', userId),
    db.from('password_reset_tokens').delete().eq('user_id', userId),
  ])

  const { error } = await db.auth.admin.deleteUser(userId)
  if (error) redirect(backTo(userId, { err: 'delete', msg: safeErr(error.message) }))

  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: userId,
    action: 'account.delete_hard',
    metadata: { stripeCleanup, stripeCustomerId },
  })

  revalidatePath('/admin/users')
  redirect('/admin/users?saved=deleted')
}

export async function endImpersonation() {
  const cookieStore = await cookies()
  const raw = cookieStore.get(IMPERSONATION_COOKIE)?.value
  let adminId: string | null = null
  let targetId: string | null = null
  try {
    if (raw) {
      const parsed = JSON.parse(raw) as { adminId?: string; targetId?: string }
      adminId = parsed.adminId ?? null
      targetId = parsed.targetId ?? null
    }
  } catch {
    // ignore
  }

  cookieStore.delete(IMPERSONATION_COOKIE)

  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()

  await logAdminAuditEvent({
    actorUserId: adminId,
    targetUserId: targetId,
    action: 'impersonation.end',
  })

  redirect('/login?hint=impersonation_ended')
}

