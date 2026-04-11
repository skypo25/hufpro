'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdmin } from '@/lib/admin/requireAdmin'
import { logAdminAuditEvent } from '@/lib/admin/audit'
import { sendDirectoryClaimDecisionEmail } from '@/lib/directory/claims/sendClaimDecisionEmail.server'
import { runApproveDirectoryClaimById } from '@/lib/admin/runDirectoryClaimApprove'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'

function safeErr(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.slice(0, 220)
}

function claimsDetailPath(claimId: string, q: Record<string, string> = {}) {
  const p = new URLSearchParams(q)
  const qs = p.toString()
  return `/admin/directory/claims/${claimId}${qs ? `?${qs}` : ''}`
}

function readClaimId(formData: FormData): string {
  return String(formData.get('claimId') ?? '').trim()
}

/**
 * Approve: nur wenn Claim noch pending und Profil frei oder bereits dem Antragsteller zugeordnet.
 * Bei Profil-Konflikt Rollback des Claim-Updates.
 */
export async function approveAdminDirectoryClaim(formData: FormData) {
  const claimId = readClaimId(formData)
  if (!claimId) redirect('/admin/directory/claims?err=approve')

  const admin = await requireAdmin()
  const db = createSupabaseServiceRoleClient()

  const res = await runApproveDirectoryClaimById(db, admin.userId, claimId)
  if (!res.ok) {
    redirect(claimsDetailPath(claimId, { err: 'approve', msg: safeErr(res.message) }))
  }

  revalidatePath('/admin/directory/claims')
  revalidatePath(`/admin/directory/claims/${claimId}`)
  revalidatePath('/admin/directory/profiles')
  revalidatePath(`/admin/directory/profiles/${res.profileId}`)
  redirect(claimsDetailPath(claimId, { ok: 'approved' }))
}

/**
 * Reject: Claim schließen; Profil nur anfassen, wenn kein weiterer pending Claim existiert und claim_state = claim_pending.
 */
export async function rejectAdminDirectoryClaim(formData: FormData) {
  const claimId = readClaimId(formData)
  if (!claimId) redirect('/admin/directory/claims?err=reject')

  const admin = await requireAdmin()
  const db = createSupabaseServiceRoleClient()
  const decidedAt = new Date().toISOString()
  const reasonRaw = String(formData.get('rejection_reason') ?? '')
  const rejection_reason = reasonRaw.trim() === '' ? null : reasonRaw.trim().slice(0, 4000)

  const claimRes = await db
    .from('directory_claims')
    .select('id, directory_profile_id, status')
    .eq('id', claimId)
    .maybeSingle()

  if (claimRes.error || !claimRes.data) {
    redirect(claimsDetailPath(claimId, { err: 'reject', msg: 'Antrag nicht gefunden.' }))
  }
  if (claimRes.data.status !== 'pending') {
    redirect(claimsDetailPath(claimId, { err: 'reject', msg: 'Antrag ist nicht mehr offen.' }))
  }

  const profileId = claimRes.data.directory_profile_id

  const upd = await db
    .from('directory_claims')
    .update({
      status: 'rejected',
      decided_at: decidedAt,
      decided_by_user_id: admin.userId,
      rejection_reason,
    })
    .eq('id', claimId)
    .eq('status', 'pending')
    .select('id, claimant_user_id, claimant_email')
    .maybeSingle()

  if (upd.error || !upd.data) {
    redirect(
      claimsDetailPath(claimId, {
        err: 'reject',
        msg: safeErr(upd.error?.message ?? 'Update fehlgeschlagen'),
      })
    )
  }

  const { data: profMeta } = await db
    .from('directory_profiles')
    .select('slug, display_name')
    .eq('id', profileId)
    .maybeSingle()

  const { count, error: cntErr } = await db
    .from('directory_claims')
    .select('id', { count: 'exact', head: true })
    .eq('directory_profile_id', profileId)
    .eq('status', 'pending')

  if (!cntErr && (count ?? 0) === 0) {
    await db
      .from('directory_profiles')
      .update({ claim_state: 'unclaimed' })
      .eq('id', profileId)
      .eq('claim_state', 'claim_pending')
  }

  await logAdminAuditEvent({
    actorUserId: admin.userId,
    targetUserId: upd.data.claimant_user_id,
    action: 'directory_claim.reject',
    message: claimId,
    metadata: { directory_profile_id: profileId, claim_id: claimId },
  })

  await sendDirectoryClaimDecisionEmail({
    kind: 'rejected',
    db,
    claimantUserId: upd.data.claimant_user_id,
    claimantEmailSnapshot: String(upd.data.claimant_email ?? ''),
    profileDisplayName: String(profMeta?.display_name ?? ''),
    profileSlug: String(profMeta?.slug ?? ''),
    rejectionReason: rejection_reason,
  })

  revalidatePath('/admin/directory/claims')
  revalidatePath(`/admin/directory/claims/${claimId}`)
  revalidatePath('/admin/directory/profiles')
  revalidatePath(`/admin/directory/profiles/${profileId}`)
  redirect(claimsDetailPath(claimId, { ok: 'rejected' }))
}
