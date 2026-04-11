import 'server-only'

import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'

export type DirectoryClaimStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn'

export type AdminDirectoryClaimListRow = {
  id: string
  directory_profile_id: string
  claimant_user_id: string
  status: DirectoryClaimStatus
  submitted_at: string
  decided_at: string | null
  decided_by_user_id: string | null
  rejection_reason: string | null
  claimant_display_name: string
  claimant_email: string
  message: string
  proof_url: string | null
  profile_slug: string
  profile_display_name: string
  profile_listing_status: string
  profile_claim_state: string
  profile_claimed_by_user_id: string | null
}

export type AdminDirectoryClaimDetail = AdminDirectoryClaimListRow

type ClaimRow = {
  id: string
  directory_profile_id: string
  claimant_user_id: string
  status: string
  submitted_at: string
  decided_at: string | null
  decided_by_user_id: string | null
  rejection_reason: string | null
  claimant_display_name: string
  claimant_email: string
  message: string
  proof_url: string | null
}

type ProfileRow = {
  id: string
  slug: string
  display_name: string
  listing_status: string
  claim_state: string
  claimed_by_user_id: string | null
}

function mapClaimWithProfile(c: ClaimRow, p: ProfileRow | undefined): AdminDirectoryClaimListRow {
  if (!p) {
    return {
      ...c,
      status: c.status as DirectoryClaimStatus,
      profile_slug: '—',
      profile_display_name: '—',
      profile_listing_status: '—',
      profile_claim_state: '—',
      profile_claimed_by_user_id: null,
    }
  }
  return {
    id: c.id,
    directory_profile_id: c.directory_profile_id,
    claimant_user_id: c.claimant_user_id,
    status: c.status as DirectoryClaimStatus,
    submitted_at: c.submitted_at,
    decided_at: c.decided_at,
    decided_by_user_id: c.decided_by_user_id,
    rejection_reason: c.rejection_reason,
    claimant_display_name: c.claimant_display_name,
    claimant_email: c.claimant_email,
    message: c.message,
    proof_url: c.proof_url,
    profile_slug: p.slug,
    profile_display_name: p.display_name,
    profile_listing_status: p.listing_status,
    profile_claim_state: p.claim_state,
    profile_claimed_by_user_id: p.claimed_by_user_id,
  }
}

export async function fetchAdminDirectoryClaimsList(): Promise<AdminDirectoryClaimListRow[]> {
  const db = createSupabaseServiceRoleClient()
  const { data: claims, error } = await db
    .from('directory_claims')
    .select(
      `
      id,
      directory_profile_id,
      claimant_user_id,
      status,
      submitted_at,
      decided_at,
      decided_by_user_id,
      rejection_reason,
      claimant_display_name,
      claimant_email,
      message,
      proof_url
    `
    )
    .order('submitted_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const list = (claims ?? []) as ClaimRow[]
  const profileIds = [...new Set(list.map((c) => c.directory_profile_id))]
  if (profileIds.length === 0) return []

  const { data: profiles, error: pErr } = await db
    .from('directory_profiles')
    .select('id, slug, display_name, listing_status, claim_state, claimed_by_user_id')
    .in('id', profileIds)

  if (pErr) {
    throw new Error(pErr.message)
  }

  const byId = new Map((profiles ?? []).map((p) => [(p as ProfileRow).id, p as ProfileRow]))

  return list.map((c) => mapClaimWithProfile(c, byId.get(c.directory_profile_id)))
}

export async function fetchAdminDirectoryClaimById(claimId: string): Promise<AdminDirectoryClaimDetail | null> {
  const db = createSupabaseServiceRoleClient()
  const { data: c, error } = await db
    .from('directory_claims')
    .select(
      `
      id,
      directory_profile_id,
      claimant_user_id,
      status,
      submitted_at,
      decided_at,
      decided_by_user_id,
      rejection_reason,
      claimant_display_name,
      claimant_email,
      message,
      proof_url
    `
    )
    .eq('id', claimId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  if (!c) return null

  const row = c as ClaimRow
  const { data: p, error: pErr } = await db
    .from('directory_profiles')
    .select('id, slug, display_name, listing_status, claim_state, claimed_by_user_id')
    .eq('id', row.directory_profile_id)
    .maybeSingle()

  if (pErr) {
    throw new Error(pErr.message)
  }

  return mapClaimWithProfile(row, p as ProfileRow | null | undefined)
}
