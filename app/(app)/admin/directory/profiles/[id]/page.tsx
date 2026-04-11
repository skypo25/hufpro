import { notFound } from 'next/navigation'

import AdminDirectoryProfileDetail from '@/components/admin/directory/AdminDirectoryProfileDetail'
import { parseAdminDirectoryProfileFlash } from '@/lib/admin/directoryProfileAdminFlash'
import { fetchAdminDirectoryProfileDetail } from '@/lib/admin/directoryProfileDetailData'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AdminDirectoryProfileDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const sp = await searchParams

  let detail: Awaited<ReturnType<typeof fetchAdminDirectoryProfileDetail>> = null
  try {
    detail = await fetchAdminDirectoryProfileDetail(id)
  } catch {
    notFound()
  }

  if (!detail) {
    notFound()
  }

  const flash = parseAdminDirectoryProfileFlash(sp)

  return <AdminDirectoryProfileDetail profileId={id} d={detail} flash={flash} />
}
