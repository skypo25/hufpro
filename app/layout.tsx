import type { Metadata, Viewport } from 'next'
import { DM_Sans, Fraunces } from 'next/font/google'
import './globals.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import RegisterSw from '@/components/RegisterSw'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['300', '500', '700'],
  variable: '--font-fraunces',
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
    <html lang="de" className={`${dmSans.variable} ${fraunces.variable}`}>
      <body>
        {children}
        <RegisterSw />
      </body>
    </html>
  )
}