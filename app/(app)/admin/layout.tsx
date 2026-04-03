import { requireAdmin } from '@/lib/admin/requireAdmin'

export default async function AdminSectionLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return <>{children}</>
}
