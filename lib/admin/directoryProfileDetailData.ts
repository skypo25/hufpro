import 'server-only'

import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'

import { computeDirectoryProfileCompleteness, type DirectoryProfileCompleteness } from '@/lib/admin/directoryProfileCompleteness'

export type AdminDirectoryProfileEntitlementRow = {
  source: string
  active_until: string | null
  isActive: boolean
}

export type AdminDirectoryProfileDetail = {
  profile: {
    id: string
    slug: string
    display_name: string
    practice_name: string | null
    short_description: string | null
    description: string | null
    street: string | null
    house_number: string | null
    postal_code: string | null
    city: string | null
    state: string | null
    country: string
    latitude: number | null
    longitude: number | null
    listing_status: string
    claim_state: string
    verification_state: string
    claimed_by_user_id: string | null
    data_origin: string
    service_type: string
    created_at: string | null
    updated_at: string | null
  }
  specialtyLabels: string[]
  subcategoryLabels: string[]
  methodLabels: string[]
  animalTypeLabels: string[]
  mediaLogoOrPhotoCount: number
  socialCount: number
  socialLinks: { platform: string; url: string }[]
  entitlements: AdminDirectoryProfileEntitlementRow[]
  pendingClaimIds: string[]
  completeness: DirectoryProfileCompleteness
  owner:
    | null
    | {
        userId: string
        email: string | null
        /** explizit in directory_user_access oder implizit App, wenn keine Zeile existiert */
        accessScope: 'app' | 'directory_only' | 'implicit_app'
        billing: { subscription_status: string | null; trial_ends_at: string | null } | null
      }
}

function isEntitlementActive(activeUntil: string | null): boolean {
  if (activeUntil == null) return true
  return new Date(activeUntil).getTime() > Date.now()
}

/** Supabase liefert eingebettete FK je nach Relation als Objekt oder einelementiges Array. */
function joinedName(row: Record<string, unknown>, relKey: string): string | undefined {
  const rel = row[relKey]
  if (rel == null) return undefined
  if (Array.isArray(rel)) {
    const first = rel[0]
    if (first && typeof first === 'object' && 'name' in first) {
      return String((first as { name: unknown }).name)
    }
    return undefined
  }
  if (typeof rel === 'object' && 'name' in rel) {
    return String((rel as { name: unknown }).name)
  }
  return undefined
}

export async function fetchAdminDirectoryProfileDetail(profileId: string): Promise<AdminDirectoryProfileDetail | null> {
  const db = createSupabaseServiceRoleClient()

  const { data: prof, error: pErr } = await db
    .from('directory_profiles')
    .select(
      [
        'id',
        'slug',
        'display_name',
        'practice_name',
        'short_description',
        'description',
        'street',
        'house_number',
        'postal_code',
        'city',
        'state',
        'country',
        'latitude',
        'longitude',
        'listing_status',
        'claim_state',
        'verification_state',
        'claimed_by_user_id',
        'data_origin',
        'service_type',
        'created_at',
        'updated_at',
      ].join(', ')
    )
    .eq('id', profileId)
    .maybeSingle()

  if (pErr || !prof) return null

  const profileRow = prof as unknown as AdminDirectoryProfileDetail['profile']
  const ownerId = profileRow.claimed_by_user_id

  const [
    specRes,
    subRes,
    methRes,
    animRes,
    mediaRes,
    socialRes,
    entRes,
    claimsRes,
    accessRes,
    billRes,
  ] = await Promise.all([
    db
      .from('directory_profile_specialties')
      .select('directory_specialties(name)')
      .eq('directory_profile_id', profileId),
    db
      .from('directory_profile_subcategories')
      .select('directory_subcategories(name)')
      .eq('directory_profile_id', profileId),
    db
      .from('directory_profile_methods')
      .select('directory_methods(name)')
      .eq('directory_profile_id', profileId),
    db
      .from('directory_profile_animal_types')
      .select('directory_animal_types(name)')
      .eq('directory_profile_id', profileId),
    db
      .from('directory_profile_media')
      .select('*', { count: 'exact', head: true })
      .eq('directory_profile_id', profileId)
      .in('media_type', ['logo', 'photo']),
    db.from('directory_profile_social_links').select('platform, url').eq('directory_profile_id', profileId),
    db.from('directory_profile_top_entitlements').select('source, active_until').eq('directory_profile_id', profileId),
    db
      .from('directory_claims')
      .select('id')
      .eq('directory_profile_id', profileId)
      .eq('status', 'pending'),
    ownerId
      ? db.from('directory_user_access').select('access_scope').eq('user_id', ownerId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    ownerId
      ? db.from('billing_accounts').select('subscription_status, trial_ends_at').eq('user_id', ownerId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  const specialtyLabels = (specRes.data ?? [])
    .map((r) => joinedName(r as Record<string, unknown>, 'directory_specialties'))
    .filter((x): x is string => Boolean(x))
  const subcategoryLabels = (subRes.data ?? [])
    .map((r) => joinedName(r as Record<string, unknown>, 'directory_subcategories'))
    .filter((x): x is string => Boolean(x))
  const methodLabels = (methRes.data ?? [])
    .map((r) => joinedName(r as Record<string, unknown>, 'directory_methods'))
    .filter((x): x is string => Boolean(x))
  const animalTypeLabels = (animRes.data ?? [])
    .map((r) => joinedName(r as Record<string, unknown>, 'directory_animal_types'))
    .filter((x): x is string => Boolean(x))

  const mediaLogoOrPhotoCount = mediaRes.count ?? 0

  const socialRows = (socialRes.data ?? []) as { platform: string; url: string }[]
  const socialCount = socialRows.length

  const entRows = (entRes.data ?? []) as { source: string; active_until: string | null }[]
  const entitlements: AdminDirectoryProfileEntitlementRow[] = entRows.map((e) => ({
    source: e.source,
    active_until: e.active_until,
    isActive: isEntitlementActive(e.active_until),
  }))

  const pendingClaimIds = ((claimsRes.data ?? []) as { id: string }[]).map((c) => c.id)

  const completeness = computeDirectoryProfileCompleteness({
    profile: {
      short_description: profileRow.short_description,
      description: profileRow.description,
    },
    methodCount: methodLabels.length,
    animalTypeCount: animalTypeLabels.length,
    mediaLogoOrPhotoCount,
    socialLinkCount: socialCount,
  })

  let owner: AdminDirectoryProfileDetail['owner'] = null
  if (ownerId) {
    const scopeRow = accessRes.data as { access_scope?: string } | null
    const rawScope = scopeRow?.access_scope ?? null
    let accessScope: 'app' | 'directory_only' | 'implicit_app' =
      rawScope === 'directory_only'
        ? 'directory_only'
        : rawScope === 'app'
          ? 'app'
          : 'implicit_app'

    const { data: authUser, error: authErr } = await db.auth.admin.getUserById(ownerId)
    const email = authErr ? null : (authUser.user?.email ?? null)

    const bill = billRes.data as { subscription_status: string | null; trial_ends_at: string | null } | null

    owner = {
      userId: ownerId,
      email,
      accessScope,
      billing: bill
        ? { subscription_status: bill.subscription_status ?? null, trial_ends_at: bill.trial_ends_at ?? null }
        : null,
    }
  }

  return {
    profile: profileRow,
    specialtyLabels,
    subcategoryLabels,
    methodLabels,
    animalTypeLabels,
    mediaLogoOrPhotoCount,
    socialCount,
    socialLinks: socialRows,
    entitlements,
    pendingClaimIds,
    completeness,
    owner,
  }
}
