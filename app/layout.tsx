import type { Metadata, Viewport } from 'next'
import { Outfit, DM_Sans } from 'next/font/google'
import './globals.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import RegisterSw from '@/components/RegisterSw'
import Preloader from '@/components/Preloader'
import RouteLoader from '@/components/RouteLoader'

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})


export const metadata: Metadata = {
  title: 'Hufpflege Software',
  description: 'Hufpflege Software für Kunden, Pferde und Dokumentationen',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'HufPro', statusBarStyle: 'black-translucent' },
}

export const viewport: Viewport = {
  themeColor: '#1b1f23',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover', // Safe-Area (Notch/Dynamic Island) nutzen, damit env(safe-area-inset-*) wirkt
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de" className={`${dmSans.variable} ${outfit.variable}`}>
      <body>
        <Preloader />
        <RouteLoader />
        {children}
        <RegisterSw />
      </body>
    </html>
  )
}