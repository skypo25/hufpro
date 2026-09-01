import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { fetchDirectoryOwnerStatsSeries } from '@/lib/directory/stats/fetchDirectoryOwnerStatsSeries.server'
import { DirectoryStatisticsPageClient } from '@/components/directory/intern/DirectoryStatisticsPageClient'

import '@/components/directory/intern/directory-statistics-page.css'
import AppPage from '@/components/layout/AppPage'

export const dynamic = 'force-dynamic'

export default async function DirectoryStatistikPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('directory_profiles')
    .select('id')
    .eq('claimed_by_user_id', user.id)
    .maybeSingle()

  const profileId = (profile as { id?: string } | null)?.id ?? null
  if (!profileId) redirect('/directory/mein-profil')

  const stats = await fetchDirectoryOwnerStatsSeries({ userId: user.id, profileId })
  if (!stats) redirect('/directory/mein-profil')

  return (
    <AppPage>
      <DirectoryStatisticsPageClient
        initial={{
          profileViewsTotal: stats.totals.profileViewsTotal,
          contactInquiriesDaily: stats.contactInquiriesDaily,
          analyticsDaily: stats.analyticsDaily,
        }}
      />
    </AppPage>
  )
}