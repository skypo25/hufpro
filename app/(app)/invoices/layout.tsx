import { requireUserFeature } from '@/lib/admin/requireUserFeature'

export default async function InvoicesSectionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireUserFeature('invoices')
  return children
}
