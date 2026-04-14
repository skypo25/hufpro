import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'

export type DirectoryOwnerPremiumStats = {
  profileViewsTotal: number
  contactInquiriesTotal: number
  contactInquiriesLast7Days: number
  contactInquiriesLast30Days: number
}

/**
 * Lädt Aufruf- und Kontakt-Kennzahlen für die Profil-Inhaber:in (nur nach Ownership-Check).
 * Kontaktanfragen stammen aus directory_contact_inquiries; Aufrufe aus directory_profile_stats.
 */
export async function fetchDirectoryOwnerPremiumStats(args: {
  userId: string
  profileId: string
}): Promise<DirectoryOwnerPremiumStats | null> {
  const supabase = await createSupabaseServerClient()
  const { data: own, error: ownErr } = await supabase
    .from('directory_profiles')
    .select('id')
    .eq('id', args.profileId)
    .eq('claimed_by_user_id', args.userId)
    .maybeSingle()

  if (ownErr || !own) return null

  let admin: ReturnType<typeof createSupabaseServiceRoleClient>
  try {
    admin = createSupabaseServiceRoleClient()
  } catch {
    return null
  }

  const { data: statsRow } = await admin
    .from('directory_profile_stats')
    .select('profile_views_total')
    .eq('directory_profile_id', args.profileId)
    .maybeSingle()

  const profileViewsTotal = Number((statsRow as { profile_views_total?: unknown } | null)?.profile_views_total ?? 0) || 0

  const now = new Date()
  const d7 = new Date(now)
  d7.setDate(d7.getDate() - 7)
  const d30 = new Date(now)
  d30.setDate(d30.getDate() - 30)

  const iso7 = d7.toISOString()
  const iso30 = d30.toISOString()

  const [totalC, c7, c30] = await Promise.all([
    admin
      .from('directory_contact_inquiries')
      .select('id', { count: 'exact', head: true })
      .eq('directory_profile_id', args.profileId),
    admin
      .from('directory_contact_inquiries')
      .select('id', { count: 'exact', head: true })
      .eq('directory_profile_id', args.profileId)
      .gte('created_at', iso7),
    admin
      .from('directory_contact_inquiries')
      .select('id', { count: 'exact', head: true })
      .eq('directory_profile_id', args.profileId)
      .gte('created_at', iso30),
  ])

  return {
    profileViewsTotal,
    contactInquiriesTotal: totalC.count ?? 0,
    contactInquiriesLast7Days: c7.count ?? 0,
    contactInquiriesLast30Days: c30.count ?? 0,
  }
}
