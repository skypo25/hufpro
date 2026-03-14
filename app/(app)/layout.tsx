import AppLayoutClient from '@/components/AppLayoutClient'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppLayoutClient>{children}</AppLayoutClient>
}