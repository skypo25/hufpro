import { requireUserFeature } from '@/lib/admin/requireUserFeature'

export default async function HorseCompareLayout({ children }: { children: React.ReactNode }) {
  await requireUserFeature('photo_compare', '/animals')
  return children
}
