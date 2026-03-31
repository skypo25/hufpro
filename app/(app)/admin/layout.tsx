import { requireAdmin } from '@/lib/admin/requireAdmin'
import { fetchAdminUserDirectoryStats } from '@/lib/admin/data'
import AdminSubNav from '@/components/admin/AdminSubNav'

export default async function AdminSectionLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  const stats = await fetchAdminUserDirectoryStats()
  return (
    <div>
      <AdminSubNav userCount={stats.total} />
      {children}
    </div>
  )
}
