'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/requireAdmin'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { logAdminAuditEvent } from '@/lib/admin/audit'
import { getStripe } from '@/lib/stripe/stripe'

function backTo(userId: string, q: Record<string, string> = {}) {
  const p = new URLSearchParams(q)
  const qs = p.toString()
  return `/admin/users/${userId}${qs ? `?${qs}` : ''}`
}

function safeErr(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.slice(0, 180)
}

export async function saveAdminUserNote(userId: string, formData: FormData) {
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

export async function toggleAdminUserFlag(userId: string, formData: FormData) {
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
  const current = flags[key]
  const next = current === true ? false : true
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

export async function extendTrial(userId: string, formData: FormData) {
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
  redirect(backTo(userId, { saved: 'trial' }))
}

export async function endTrialNow(userId: string) {
  const admin = await requireAdmin()
  const db = createSupabaseServiceRoleClient()
  const nowIso = new Date().toISOString()

  const { data: bill } = await db
    .from('billing_accounts')
    .select('stripe_subscription_id, subscription_status')
    .eq('user_id', userId)
    .maybeSingle()

  const subId = (bill?.stripe_subscription_id as string | null) ?? null
  if (subId) {
    try {
      const stripe = getStripe()
      let sub = await stripe.subscriptions.retrieve(subId)
      const st = (sub.status ?? '').toString()
      // Trial bei Stripe sofort beenden — sonst bleibt das Abo "trialing" und weicht von billing_accounts ab.
      if (st === 'trialing') {
        await stripe.subscriptions.update(subId, { trial_end: 'now' })
        sub = await stripe.subscriptions.retrieve(subId)
      }
      const trialEndUnix = (sub as unknown as { trial_end?: number | null }).trial_end
      const periodEndUnix = (sub as unknown as { current_period_end?: number | null }).current_period_end
      const trialEndIso = trialEndUnix
        ? new Date(trialEndUnix * 1000).toISOString()
        : nowIso
      const { error: upErr } = await db
        .from('billing_accounts')
        .update({
          subscription_status: sub.status ?? null,
          trial_ends_at: trialEndIso,
          subscription_current_period_end: periodEndUnix
            ? new Date(periodEndUnix * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
      if (upErr) redirect(backTo(userId, { err: 'trial', msg: safeErr(upErr.message) }))
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
    metadata: { at: nowIso, stripe_subscription_id: subId },
  })

  revalidatePath(`/admin/users/${userId}`)
  revalidatePath('/admin/users')
  redirect(backTo(userId, { saved: 'trial_end' }))
}

export async function setUserBan(userId: string, formData: FormData) {
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

export async function deleteUserAccount(userId: string, formData: FormData) {
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

  // Hard delete: remove app data + storage objects before deleting auth user.
  // Best-effort: if some tables/buckets are missing, continue.
  const chunk = <T,>(arr: T[], size: number) => {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
  }

  try {
    const [hoof, docPhotos] = await Promise.all([
      db.from('hoof_photos').select('file_path').eq('user_id', userId),
      db.from('documentation_photos').select('file_path').eq('user_id', userId),
    ])
    const paths = [
      ...((hoof.data as any[] | null | undefined) ?? []).map((r) => String(r.file_path || '')).filter(Boolean),
      ...((docPhotos.data as any[] | null | undefined) ?? []).map((r) => String(r.file_path || '')).filter(Boolean),
    ]
    for (const part of chunk(Array.from(new Set(paths)), 100)) {
      // Photos live in storage bucket 'hoof-photos'
      await db.storage.from('hoof-photos').remove(part).catch(() => null)
    }
  } catch {
    // ignore
  }

  try {
    // user logos are stored as `${userId}/logo.ext`
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

  // Delete domain data (order matters when no FKs exist everywhere).
  const deletes: Array<Promise<any>> = []
  deletes.push(db.from('appointment_horses').delete().eq('user_id', userId))
  deletes.push(db.from('appointments').delete().eq('user_id', userId))
  deletes.push(db.from('hoof_photos').delete().eq('user_id', userId))
  deletes.push(db.from('documentation_photos').delete().eq('user_id', userId))
  deletes.push(db.from('hoof_records').delete().eq('user_id', userId))
  deletes.push(db.from('documentation_records').delete().eq('user_id', userId))
  deletes.push(db.from('horses').delete().eq('user_id', userId))
  deletes.push(db.from('invoices').delete().eq('user_id', userId))
  deletes.push(db.from('customers').delete().eq('user_id', userId))
  // Tables with FK cascade will be cleaned up automatically too; these calls are harmless if already gone.
  deletes.push(db.from('billing_accounts').delete().eq('user_id', userId))
  deletes.push(db.from('user_settings').delete().eq('user_id', userId))
  deletes.push(db.from('admin_user_meta').delete().eq('user_id', userId))
  deletes.push(db.from('password_reset_tokens').delete().eq('user_id', userId))
  await Promise.allSettled(deletes)

  const { error } = await db.auth.admin.deleteUser(userId)
  if (error) redirect(backTo(userId, { err: 'delete', msg: safeErr(error.message) }))

  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: userId,
    action: 'account.delete_hard',
  })

  revalidatePath('/admin/users')
  redirect('/admin/users?saved=deleted')
}

