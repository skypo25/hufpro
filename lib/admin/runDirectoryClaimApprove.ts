import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { logAdminAuditEvent } from '@/lib/admin/audit'
import { sendDirectoryClaimDecisionEmail } from '@/lib/directory/claims/sendClaimDecisionEmail.server'

export type RunApproveDirectoryClaimResult =
  | { ok: true; profileId: string; claimId: string }
  | { ok: false; message: string }

/**
 * Genehmigt einen Claim (Status pending → approved, Profil claimed).
 * Wird von Claims-Admin und Profil-Detail-Admin genutzt.
 */
export async function runApproveDirectoryClaimById(
  db: SupabaseClient,
  adminUserId: string,
  claimId: string
): Promise<RunApproveDirectoryClaimResult> {
  const decidedAt = new Date().toISOString()

  const claimUp = await db
    .from('directory_claims')
    .update({
      status: 'approved',
      decided_at: decidedAt,
      decided_by_user_id: adminUserId,
      rejection_reason: null,
    })
    .eq('id', claimId)
    .eq('status', 'pending')
    .select('id, directory_profile_id, claimant_user_id, claimant_email')
    .maybeSingle()

  if (claimUp.error) {
    return { ok: false, message: claimUp.error.message.slice(0, 220) }
  }
  if (!claimUp.data) {
    return { ok: false, message: 'Antrag ist nicht mehr offen.' }
  }

  const profileId = claimUp.data.directory_profile_id
  const claimantId = claimUp.data.claimant_user_id
  const claimantEmailSnapshot = String(claimUp.data.claimant_email ?? '')

  const { data: profRow, error: profSelErr } = await db
    .from('directory_profiles')
    .select('id, claimed_by_user_id, slug, display_name')
    .eq('id', profileId)
    .maybeSingle()

  if (profSelErr || !profRow) {
    await db
      .from('directory_claims')
      .update({
        status: 'pending',
        decided_at: null,
        decided_by_user_id: null,
      })
      .eq('id', claimId)
    return { ok: false, message: profSelErr ? profSelErr.message.slice(0, 220) : 'Profil nicht gefunden.' }
  }

  const currentOwner = profRow.claimed_by_user_id as string | null
  if (currentOwner != null && currentOwner !== claimantId) {
    await db
      .from('directory_claims')
      .update({
        status: 'pending',
        decided_at: null,
        decided_by_user_id: null,
      })
      .eq('id', claimId)
    return { ok: false, message: 'Profil ist bereits einem anderen Nutzer zugeordnet.' }
  }

  const profileUp = await db
    .from('directory_profiles')
    .update({
      claimed_by_user_id: claimantId,
      claim_state: 'claimed',
    })
    .eq('id', profileId)
    .select('id')
    .maybeSingle()

  if (profileUp.error || !profileUp.data) {
    await db
      .from('directory_claims')
      .update({
        status: 'pending',
        decided_at: null,
        decided_by_user_id: null,
      })
      .eq('id', claimId)

    return {
      ok: false,
      message: profileUp.error ? profileUp.error.message.slice(0, 220) : 'Profil konnte nicht aktualisiert werden.',
    }
  }

  await logAdminAuditEvent({
    actorUserId: adminUserId,
    targetUserId: claimantId,
    action: 'directory_claim.approve',
    message: claimId,
    metadata: { directory_profile_id: profileId, claim_id: claimId },
  })

  await sendDirectoryClaimDecisionEmail({
    kind: 'approved',
    db,
    claimantUserId: claimantId,
    claimantEmailSnapshot,
    profileDisplayName: String(profRow.display_name ?? ''),
    profileSlug: String(profRow.slug ?? ''),
  })

  return { ok: true, profileId, claimId }
}
