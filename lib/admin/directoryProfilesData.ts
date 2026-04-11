import 'server-only'

import { computeDirectoryProfileCompleteness } from '@/lib/admin/directoryProfileCompleteness'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'

export type AdminDirectoryProfileListRow = {
  id: string
  slug: string
  display_name: string
  /** import | manual | merged — für Claim-Anzeige (Importe bleiben zur Beanspruchung offen) */
  data_origin: string
  listing_status: string
  claim_state: string
  verification_state: string
  claimed_by_user_id: string | null
  created_at: string | null
  updated_at: string | null
  /** Kein Owner → none; sonst app oder directory_only (ohne Eintrag in directory_user_access = app, implicit) */
  owner_access_scope: 'none' | 'app' | 'directory_only'
  /** true, wenn Owner existiert, aber kein Zeile in directory_user_access (wird wie App behandelt) */
  owner_access_implicit: boolean
  billing_subscription_status: string | null
  billing_trial_ends_at: string | null
  top_active: boolean
  top_sources: string[]
  top_until: string | null
  completeness_score: number
  completeness_passed: number
  completeness_total: number
}

type ProfileRow = {
  id: string
  slug: string
  display_name: string
  data_origin: string
  listing_status: string
  claim_state: string
  verification_state: string
  claimed_by_user_id: string | null
  created_at: string | null
  updated_at: string | null
  short_description: string | null
  description: string | null
}

type AccessRow = { user_id: string; access_scope: 'app' | 'directory_only' | string }
type BillingRow = { user_id: string; subscription_status: string | null; trial_ends_at: string | null }
type EntRow = { directory_profile_id: string; source: string; active_until: string | null }

export async function fetchAdminDirectoryProfilesList(): Promise<AdminDirectoryProfileListRow[]> {
  const db = createSupabaseServiceRoleClient()

  const { data: profiles, error: pErr } = await db
    .from('directory_profiles')
    .select(
      'id, slug, display_name, data_origin, listing_status, claim_state, verification_state, claimed_by_user_id, created_at, updated_at, short_description, description'
    )
    .order('updated_at', { ascending: false })
    .limit(500)

  if (pErr) throw new Error(pErr.message)
  const list = (profiles ?? []) as ProfileRow[]
  if (list.length === 0) return []

  const ownerIds = [...new Set(list.map((p) => p.claimed_by_user_id).filter((x): x is string => Boolean(x)))]
  const profileIds = list.map((p) => p.id)

  const [accessRes, billingRes, entRes, methRes, animRes, mediaRes, socRes] = await Promise.all([
    ownerIds.length
      ? db.from('directory_user_access').select('user_id, access_scope').in('user_id', ownerIds)
      : Promise.resolve({ data: [], error: null }),
    ownerIds.length
      ? db.from('billing_accounts').select('user_id, subscription_status, trial_ends_at').in('user_id', ownerIds)
      : Promise.resolve({ data: [], error: null }),
    db
      .from('directory_profile_top_entitlements')
      .select('directory_profile_id, source, active_until')
      .in('directory_profile_id', profileIds)
      .or('active_until.is.null,active_until.gt.now()'),
    db.from('directory_profile_methods').select('directory_profile_id').in('directory_profile_id', profileIds),
    db.from('directory_profile_animal_types').select('directory_profile_id').in('directory_profile_id', profileIds),
    db
      .from('directory_profile_media')
      .select('directory_profile_id')
      .in('directory_profile_id', profileIds)
      .in('media_type', ['logo', 'photo']),
    db.from('directory_profile_social_links').select('directory_profile_id').in('directory_profile_id', profileIds),
  ])

  if (accessRes.error) throw new Error(accessRes.error.message)
  if (billingRes.error) throw new Error(billingRes.error.message)
  if (entRes.error) throw new Error(entRes.error.message)
  if (methRes.error) throw new Error(methRes.error.message)
  if (animRes.error) throw new Error(animRes.error.message)
  if (mediaRes.error) throw new Error(mediaRes.error.message)
  if (socRes.error) throw new Error(socRes.error.message)

  const accessByUser = new Map<string, AccessRow>()
  for (const r of (accessRes.data ?? []) as AccessRow[]) accessByUser.set(r.user_id, r)

  const billingByUser = new Map<string, BillingRow>()
  for (const r of (billingRes.data ?? []) as BillingRow[]) billingByUser.set(r.user_id, r)

  const entsByProfile = new Map<string, EntRow[]>()
  for (const e of (entRes.data ?? []) as EntRow[]) {
    const arr = entsByProfile.get(e.directory_profile_id) ?? []
    arr.push(e)
    entsByProfile.set(e.directory_profile_id, arr)
  }

  const countByProfile = (rows: { directory_profile_id: string }[]) => {
    const m = new Map<string, number>()
    for (const r of rows) {
      const id = r.directory_profile_id
      m.set(id, (m.get(id) ?? 0) + 1)
    }
    return m
  }

  const methodCountBy = countByProfile((methRes.data ?? []) as { directory_profile_id: string }[])
  const animalCountBy = countByProfile((animRes.data ?? []) as { directory_profile_id: string }[])
  const mediaCountBy = countByProfile((mediaRes.data ?? []) as { directory_profile_id: string }[])
  const socialCountBy = countByProfile((socRes.data ?? []) as { directory_profile_id: string }[])

  const rows: AdminDirectoryProfileListRow[] = list.map((p) => {
    const ownerId = p.claimed_by_user_id
    const scopeRaw = ownerId ? (accessByUser.get(ownerId)?.access_scope ?? null) : null
    const owner_access_implicit = Boolean(ownerId) && scopeRaw == null
    const owner_access_scope: AdminDirectoryProfileListRow['owner_access_scope'] = !ownerId
      ? 'none'
      : scopeRaw === 'directory_only'
        ? 'directory_only'
        : scopeRaw === 'app'
          ? 'app'
          : 'app'

    const bill = ownerId ? billingByUser.get(ownerId) ?? null : null

    const ents = entsByProfile.get(p.id) ?? []
    const top_sources = [...new Set(ents.map((e) => e.source))].sort()
    const top_active = top_sources.length > 0
    const top_until = ents
      .map((e) => e.active_until)
      .filter((x): x is string => Boolean(x))
      .sort()
      .slice(-1)[0] ?? null

    const completeness = computeDirectoryProfileCompleteness({
      profile: { short_description: p.short_description, description: p.description },
      methodCount: methodCountBy.get(p.id) ?? 0,
      animalTypeCount: animalCountBy.get(p.id) ?? 0,
      mediaLogoOrPhotoCount: mediaCountBy.get(p.id) ?? 0,
      socialLinkCount: socialCountBy.get(p.id) ?? 0,
    })

    return {
      ...p,
      data_origin: String(p.data_origin ?? 'manual').trim() || 'manual',
      owner_access_scope,
      owner_access_implicit,
      billing_subscription_status: bill?.subscription_status ?? null,
      billing_trial_ends_at: bill?.trial_ends_at ?? null,
      top_active,
      top_sources,
      top_until,
      completeness_score: completeness.score,
      completeness_passed: completeness.passed,
      completeness_total: completeness.total,
    }
  })

  return rows
}

