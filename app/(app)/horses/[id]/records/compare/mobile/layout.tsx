import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Fotovergleich · App',
  appleWebApp: { capable: true },
}

export const viewport: Viewport = {
  themeColor: '#1c2023',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function HoofCompareMobileLayout({ children }: { children: React.ReactNode }) {
  return children
}
