import type { Metadata, Viewport } from 'next'
import { Outfit, DM_Sans } from 'next/font/google'
import './globals.css'
/* Direkt importieren: verschachteltes @import nach tailwindcss wird sonst oft nicht gebündelt → /behandler wirkt „ohne CSS“. */
import './behandler-verzeichnis.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import Preloader from '@/components/Preloader'
import RouteLoader from '@/components/RouteLoader'
import { SerwistProvider } from './serwist-provider'

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

function appBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'https://app.anidocs.de'
  const url = raw.startsWith('http') ? raw : `https://${raw}`
  return url.replace(/\/+$/, '')
}

export const metadata: Metadata = {
  title: 'AniDocs',
  description: 'AniDocs – Dokumentation, Kunden und Termine für Tiergesundheitsberufe',
  metadataBase: new URL(appBaseUrl()),
  icons: {
    icon: [
      { url: '/icon.png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
    shortcut: ['/icon.png'],
  },
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'AniDocs', statusBarStyle: 'black-translucent' },
  openGraph: {
    type: 'website',
    siteName: 'AniDocs',
    title: 'AniDocs',
    description: 'AniDocs – Dokumentation, Kunden und Termine für Tiergesundheitsberufe',
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: 'AniDocs' }],
  },
  twitter: {
    card: 'summary',
    title: 'AniDocs',
    description: 'AniDocs – Dokumentation, Kunden und Termine für Tiergesundheitsberufe',
    images: ['/icons/icon-512.png'],
  },
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
      <head>
        {/* Erste Pixel: Hintergrund sofort, ohne auf globals.css zu warten */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html,body{background:#f7f7f7;color:#1c1c1c;margin:0;min-height:100%}
              @media (prefers-color-scheme: dark){
                html,body{background:#111315;color:#f1f2f0}
              }
            `,
          }}
        />
        <link rel="preload" href="/icon.png" as="image" />
      </head>
      <body>
        <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV === 'development'}>
          <Preloader />
          <RouteLoader />
          {children}
        </SerwistProvider>
      </body>
    </html>
  )
}