'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdmin } from '@/lib/admin/requireAdmin'
import { logAdminAuditEvent } from '@/lib/admin/audit'
import { runApproveDirectoryClaimById } from '@/lib/admin/runDirectoryClaimApprove'
import { sendDirectoryClaimDecisionEmail } from '@/lib/directory/claims/sendClaimDecisionEmail.server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function safeErr(err: unknown) {
  return (err instanceof Error ? err.message : String(err)).slice(0, 220)
}

function profileDetailPath(profileId: string, q: Record<string, string> = {}) {
  const p = new URLSearchParams(q)
  const qs = p.toString()
  return `/admin/directory/profiles/${profileId}${qs ? `?${qs}` : ''}`
}

function readProfileId(formData: FormData): string {
  return String(formData.get('profileId') ?? '').trim()
}

function revalidateProfile(profileId: string) {
  revalidatePath('/admin/directory/profiles')
  revalidatePath(`/admin/directory/profiles/${profileId}`)
  revalidatePath('/behandler')
}

/** listing_status */
export async function adminSetDirectoryProfileListingStatus(formData: FormData) {
  const profileId = readProfileId(formData)
  const listing_status = String(formData.get('listing_status') ?? '').trim()
  const allowed = ['draft', 'published', 'hidden', 'blocked'] as const
  if (!profileId || !UUID_RE.test(profileId) || !allowed.includes(listing_status as (typeof allowed)[number])) {
    redirect('/admin/directory/profiles?err=listing')
  }
  const admin = await requireAdmin()
  const db = createSupabaseServiceRoleClient()
  const { error } = await db.from('directory_profiles').update({ listing_status }).eq('id', profileId)
  if (error) redirect(profileDetailPath(profileId, { err: 'listing', msg: safeErr(error) }))
  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: null,
    action: 'directory_profile.listing_status',
    message: profileId,
    metadata: { listing_status },
  })
  revalidateProfile(profileId)
  redirect(profileDetailPath(profileId, { ok: 'listing' }))
}

/** verification_state */
export async function adminSetDirectoryProfileVerification(formData: FormData) {
  const profileId = readProfileId(formData)
  const verification_state = String(formData.get('verification_state') ?? '').trim()
  const allowed = ['none', 'pending', 'verified', 'rejected'] as const
  if (!profileId || !UUID_RE.test(profileId) || !allowed.includes(verification_state as (typeof allowed)[number])) {
    redirect('/admin/directory/profiles?err=verify')
  }
  const admin = await requireAdmin()
  const db = createSupabaseServiceRoleClient()
  const { error } = await db.from('directory_profiles').update({ verification_state }).eq('id', profileId)
  if (error) redirect(profileDetailPath(profileId, { err: 'verify', msg: safeErr(error) }))
  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: null,
    action: 'directory_profile.verification_state',
    message: profileId,
    metadata: { verification_state },
  })
  revalidateProfile(profileId)
  redirect(profileDetailPath(profileId, { ok: 'verify' }))
}

export async function adminMarkProfileVerified(formData: FormData) {
  const fd = new FormData()
  fd.set('profileId', readProfileId(formData))
  fd.set('verification_state', 'verified')
  return adminSetDirectoryProfileVerification(fd)
}

export async function adminClearProfileVerification(formData: FormData) {
  const fd = new FormData()
  fd.set('profileId', readProfileId(formData))
  fd.set('verification_state', 'none')
  return adminSetDirectoryProfileVerification(fd)
}

export async function adminMarkProfileVerificationPending(formData: FormData) {
  const fd = new FormData()
  fd.set('profileId', readProfileId(formData))
  fd.set('verification_state', 'pending')
  return adminSetDirectoryProfileVerification(fd)
}

export async function adminPublishDirectoryProfile(formData: FormData) {
  const fd = new FormData()
  fd.set('profileId', readProfileId(formData))
  fd.set('listing_status', 'published')
  return adminSetDirectoryProfileListingStatus(fd)
}

export async function adminHideDirectoryProfile(formData: FormData) {
  const fd = new FormData()
  fd.set('profileId', readProfileId(formData))
  fd.set('listing_status', 'hidden')
  return adminSetDirectoryProfileListingStatus(fd)
}

export async function adminDraftDirectoryProfile(formData: FormData) {
  const fd = new FormData()
  fd.set('profileId', readProfileId(formData))
  fd.set('listing_status', 'draft')
  return adminSetDirectoryProfileListingStatus(fd)
}

/** Top: manual activate (days default 30) */
export async function adminActivateManualTop(formData: FormData) {
  const profileId = readProfileId(formData)
  const daysRaw = Number(formData.get('days') ?? 30)
  const days = Number.isFinite(daysRaw) && daysRaw > 0 && daysRaw <= 3650 ? Math.floor(daysRaw) : 30
  if (!profileId || !UUID_RE.test(profileId)) redirect('/admin/directory/profiles?err=top')

  const admin = await requireAdmin()
  const db = createSupabaseServiceRoleClient()
  const until = new Date()
  until.setDate(until.getDate() + days)

  const { error } = await db.from('directory_profile_top_entitlements').upsert(
    {
      directory_profile_id: profileId,
      source: 'manual',
      active_until: until.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'directory_profile_id,source' }
  )
  if (error) redirect(profileDetailPath(profileId, { err: 'top', msg: safeErr(error) }))
  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: null,
    action: 'directory_profile.top_manual_activate',
    message: profileId,
    metadata: { days, active_until: until.toISOString() },
  })
  revalidateProfile(profileId)
  redirect(profileDetailPath(profileId, { ok: 'top_activate' }))
}

/** Extend manual Top by +days from max(now, current manual until) */
export async function adminExtendManualTop(formData: FormData) {
  const profileId = readProfileId(formData)
  const daysRaw = Number(formData.get('days') ?? 30)
  const days = Number.isFinite(daysRaw) && daysRaw > 0 && daysRaw <= 3650 ? Math.floor(daysRaw) : 30
  if (!profileId || !UUID_RE.test(profileId)) redirect('/admin/directory/profiles?err=top')

  const admin = await requireAdmin()
  const db = createSupabaseServiceRoleClient()

  const { data: row, error: selErr } = await db
    .from('directory_profile_top_entitlements')
    .select('active_until')
    .eq('directory_profile_id', profileId)
    .eq('source', 'manual')
    .maybeSingle()

  if (selErr) redirect(profileDetailPath(profileId, { err: 'top', msg: safeErr(selErr) }))

  const now = Date.now()
  const currentUntil = row?.active_until ? new Date(String(row.active_until)).getTime() : 0
  const base = Math.max(now, currentUntil || 0)
  const next = new Date(base)
  next.setDate(next.getDate() + days)

  const { error } = await db
    .from('directory_profile_top_entitlements')
    .upsert(
      {
        directory_profile_id: profileId,
        source: 'manual',
        active_until: next.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'directory_profile_id,source' }
    )
  if (error) redirect(profileDetailPath(profileId, { err: 'top', msg: safeErr(error) }))
  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: null,
    action: 'directory_profile.top_manual_extend',
    message: profileId,
    metadata: { days, active_until: next.toISOString() },
  })
  revalidateProfile(profileId)
  redirect(profileDetailPath(profileId, { ok: 'top_extend' }))
}

export async function adminEndManualTop(formData: FormData) {
  const profileId = readProfileId(formData)
  if (!profileId || !UUID_RE.test(profileId)) redirect('/admin/directory/profiles?err=top')
  const admin = await requireAdmin()
  const db = createSupabaseServiceRoleClient()
  const { error } = await db
    .from('directory_profile_top_entitlements')
    .delete()
    .eq('directory_profile_id', profileId)
    .eq('source', 'manual')
  if (error) redirect(profileDetailPath(profileId, { err: 'top', msg: safeErr(error) }))
  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: null,
    action: 'directory_profile.top_manual_end',
    message: profileId,
    metadata: {},
  })
  revalidateProfile(profileId)
  redirect(profileDetailPath(profileId, { ok: 'top_end_manual' }))
}

/** Entfernt alle Top-Entitlements (App/Verzeichnis/Manuell) — nur mit Slug-Bestätigung */
export async function adminPurgeAllTopEntitlements(formData: FormData) {
  const profileId = readProfileId(formData)
  const confirmSlug = String(formData.get('confirmSlug') ?? '').trim()
  if (!profileId || !UUID_RE.test(profileId)) redirect('/admin/directory/profiles?err=top')

  const admin = await requireAdmin()
  const db = createSupabaseServiceRoleClient()
  const { data: prof } = await db.from('directory_profiles').select('slug').eq('id', profileId).maybeSingle()
  const slug = String(prof?.slug ?? '')
  if (!slug || confirmSlug !== slug) {
    redirect(profileDetailPath(profileId, { err: 'top', msg: 'Bestätigung (Slug) stimmt nicht.' }))
  }

  const { error } = await db.from('directory_profile_top_entitlements').delete().eq('directory_profile_id', profileId)
  if (error) redirect(profileDetailPath(profileId, { err: 'top', msg: safeErr(error) }))
  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: null,
    action: 'directory_profile.top_purge_all',
    message: profileId,
    metadata: {},
  })
  revalidateProfile(profileId)
  redirect(profileDetailPath(profileId, { ok: 'top_purge' }))
}

export async function adminReleaseDirectoryProfileOwner(formData: FormData) {
  const profileId = readProfileId(formData)
  if (!profileId || !UUID_RE.test(profileId)) redirect('/admin/directory/profiles?err=owner')

  const admin = await requireAdmin()
  const db = createSupabaseServiceRoleClient()
  const decidedAt = new Date().toISOString()

  const { data: pendingClaims, error: pErr } = await db
    .from('directory_claims')
    .select('id, claimant_user_id, claimant_email')
    .eq('directory_profile_id', profileId)
    .eq('status', 'pending')

  if (pErr) redirect(profileDetailPath(profileId, { err: 'owner', msg: safeErr(pErr) }))

  const { data: profMeta } = await db.from('directory_profiles').select('slug, display_name').eq('id', profileId).maybeSingle()

  for (const c of pendingClaims ?? []) {
    const upd = await db
      .from('directory_claims')
      .update({
        status: 'rejected',
        decided_at: decidedAt,
        decided_by_user_id: admin.userId,
        rejection_reason: 'Admin: Profil-Zuordnung wurde aufgehoben.',
      })
      .eq('id', c.id)
      .eq('status', 'pending')

    if (upd.error) {
      redirect(profileDetailPath(profileId, { err: 'owner', msg: safeErr(upd.error) }))
    }

    await sendDirectoryClaimDecisionEmail({
      kind: 'rejected',
      db,
      claimantUserId: c.claimant_user_id,
      claimantEmailSnapshot: String(c.claimant_email ?? ''),
      profileDisplayName: String(profMeta?.display_name ?? ''),
      profileSlug: String(profMeta?.slug ?? ''),
      rejectionReason: 'Die Zuordnung wurde von der Verwaltung zurückgesetzt.',
    })
  }

  const { error } = await db
    .from('directory_profiles')
    .update({
      claimed_by_user_id: null,
      claim_state: 'unclaimed',
    })
    .eq('id', profileId)

  if (error) redirect(profileDetailPath(profileId, { err: 'owner', msg: safeErr(error) }))
  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: null,
    action: 'directory_profile.owner_release',
    message: profileId,
    metadata: {},
  })
  revalidatePath('/admin/directory/claims')
  revalidateProfile(profileId)
  redirect(profileDetailPath(profileId, { ok: 'owner_release' }))
}

export async function adminAssignDirectoryProfileOwner(formData: FormData) {
  const profileId = readProfileId(formData)
  const newUserId = String(formData.get('newOwnerUserId') ?? '').trim()
  if (!profileId || !UUID_RE.test(profileId) || !UUID_RE.test(newUserId)) {
    redirect('/admin/directory/profiles?err=owner')
  }

  const admin = await requireAdmin()
  const db = createSupabaseServiceRoleClient()

  const { data: authUser, error: authErr } = await db.auth.admin.getUserById(newUserId)
  if (authErr || !authUser.user) {
    redirect(profileDetailPath(profileId, { err: 'owner', msg: 'Nutzer wurde nicht gefunden.' }))
  }

  const { error } = await db
    .from('directory_profiles')
    .update({
      claimed_by_user_id: newUserId,
      claim_state: 'claimed',
    })
    .eq('id', profileId)

  if (error) redirect(profileDetailPath(profileId, { err: 'owner', msg: safeErr(error) }))
  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: newUserId,
    action: 'directory_profile.owner_assign',
    message: profileId,
    metadata: {},
  })
  revalidateProfile(profileId)
  redirect(profileDetailPath(profileId, { ok: 'owner_assign' }))
}

export async function adminSetDirectoryOwnerAccessScope(formData: FormData) {
  const profileId = readProfileId(formData)
  const userId = String(formData.get('userId') ?? '').trim()
  const access_scope = String(formData.get('access_scope') ?? '').trim()
  if (!profileId || !UUID_RE.test(profileId) || !UUID_RE.test(userId)) {
    redirect('/admin/directory/profiles?err=scope')
  }
  if (access_scope !== 'app' && access_scope !== 'directory_only') {
    redirect(profileDetailPath(profileId, { err: 'scope', msg: 'Ungültiger Zugriffstyp.' }))
  }

  const admin = await requireAdmin()
  const db = createSupabaseServiceRoleClient()

  const { error } = await db.from('directory_user_access').upsert(
    {
      user_id: userId,
      access_scope,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (error) redirect(profileDetailPath(profileId, { err: 'scope', msg: safeErr(error) }))
  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: userId,
    action: 'directory_user_access.set',
    message: profileId,
    metadata: { access_scope },
  })
  revalidateProfile(profileId)
  redirect(profileDetailPath(profileId, { ok: 'scope' }))
}

export async function adminApprovePendingClaimForProfile(formData: FormData) {
  const profileId = readProfileId(formData)
  if (!profileId || !UUID_RE.test(profileId)) redirect('/admin/directory/profiles?err=claim')

  const admin = await requireAdmin()
  const db = createSupabaseServiceRoleClient()

  const { data: claim, error: cErr } = await db
    .from('directory_claims')
    .select('id')
    .eq('directory_profile_id', profileId)
    .eq('status', 'pending')
    .order('submitted_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (cErr) redirect(profileDetailPath(profileId, { err: 'claim', msg: safeErr(cErr) }))
  if (!claim?.id) {
    redirect(profileDetailPath(profileId, { err: 'claim', msg: 'Kein offener Claim.' }))
  }

  const res = await runApproveDirectoryClaimById(db, admin.userId, claim.id)
  if (!res.ok) {
    redirect(profileDetailPath(profileId, { err: 'claim', msg: res.message }))
  }

  revalidatePath('/admin/directory/claims')
  revalidatePath(`/admin/directory/claims/${claim.id}`)
  revalidatePath('/admin/directory/profiles')
  revalidateProfile(profileId)
  redirect(profileDetailPath(profileId, { ok: 'claim_approved' }))
}
