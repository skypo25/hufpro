import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { fetchDirectoryOwnerPremiumStats } from '@/lib/directory/stats/fetchDirectoryOwnerPremiumStats.server'

export type DirectoryOwnerStatsSeriesPoint = { dateIso: string; count: number }

export type DirectoryOwnerAnalyticsDailyRow = {
  dateIso: string
  profileViews: number
  viewsDirectorySearch: number
  viewsSearchEngine: number
  viewsDirect: number
  viewsSocial: number
  viewsOther: number
  phoneClicks: number
  shareClicks: number
}

export type DirectoryOwnerStatsSeries = {
  profileId: string
  profileSlug: string | null
  totals: NonNullable<Awaited<ReturnType<typeof fetchDirectoryOwnerPremiumStats>>>
  contactInquiriesDaily: DirectoryOwnerStatsSeriesPoint[]
  /** Tägliche Analytics (bis ca. 730 Tage zurück, Lücken = 0 in der UI). */
  analyticsDaily: DirectoryOwnerAnalyticsDailyRow[]
}

function dayKeyUtc(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function fetchDirectoryOwnerStatsSeries(args: {
  userId: string
  profileId: string
}): Promise<DirectoryOwnerStatsSeries | null> {
  const supabase = await createSupabaseServerClient()
  const { data: prof, error: ownErr } = await supabase
    .from('directory_profiles')
    .select('id, slug')
    .eq('id', args.profileId)
    .eq('claimed_by_user_id', args.userId)
    .maybeSingle()
  if (ownErr || !prof) return null

  const totals = await fetchDirectoryOwnerPremiumStats({ userId: args.userId, profileId: args.profileId })
  if (!totals) return null

  let admin: ReturnType<typeof createSupabaseServiceRoleClient>
  try {
    admin = createSupabaseServiceRoleClient()
  } catch {
    return null
  }

  const now = new Date()
  const from730 = new Date(now)
  from730.setDate(from730.getDate() - 730)
  const fromIso = from730.toISOString()

  const { data: rows } = await admin
    .from('directory_contact_inquiries')
    .select('created_at')
    .eq('directory_profile_id', args.profileId)
    .gte('created_at', fromIso)
    .order('created_at', { ascending: true })

  const map = new Map<string, number>()
  for (const r of (rows as { created_at?: string | null }[] | null) ?? []) {
    const k = r.created_at ? dayKeyUtc(r.created_at) : null
    if (!k) continue
    map.set(k, (map.get(k) ?? 0) + 1)
  }

  const contactInquiriesDaily = [...map.entries()].map(([dateIso, count]) => ({ dateIso, count }))

  const { data: aRows, error: aErr } = await admin
    .from('directory_profile_analytics_daily')
    .select(
      'bucket_date, profile_views, views_directory_search, views_search_engine, views_direct, views_social, views_other, phone_clicks, share_clicks',
    )
    .eq('directory_profile_id', args.profileId)
    .gte('bucket_date', fromIso.slice(0, 10))
    .order('bucket_date', { ascending: true })

  const analyticsDaily: DirectoryOwnerAnalyticsDailyRow[] = []
  if (!aErr && aRows) {
    for (const r of aRows as Record<string, unknown>[]) {
      const d = r.bucket_date as string
      if (!d) continue
      analyticsDaily.push({
        dateIso: d,
        profileViews: Number(r.profile_views ?? 0) || 0,
        viewsDirectorySearch: Number(r.views_directory_search ?? 0) || 0,
        viewsSearchEngine: Number(r.views_search_engine ?? 0) || 0,
        viewsDirect: Number(r.views_direct ?? 0) || 0,
        viewsSocial: Number(r.views_social ?? 0) || 0,
        viewsOther: Number(r.views_other ?? 0) || 0,
        phoneClicks: Number(r.phone_clicks ?? 0) || 0,
        shareClicks: Number(r.share_clicks ?? 0) || 0,
      })
    }
  }

  return {
    profileId: (prof as { id: string }).id,
    profileSlug: (prof as { slug?: string | null }).slug ?? null,
    totals,
    contactInquiriesDaily,
    analyticsDaily,
  }
}
