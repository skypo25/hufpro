import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/dm-sans/wght.css'
import '@fontsource-variable/outfit/wght.css'
import './globals.css'
import './form-styles.css'
/* Direkt importieren: verschachteltes @import nach tailwindcss wird sonst oft nicht gebündelt → /behandler wirkt „ohne CSS“. */
import './behandler-verzeichnis.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import { CookieConsentLayerGate } from '@/components/consent/CookieConsentLayerGate'
import AnidocsAppLoader from '@/components/AnidocsAppLoader'
import { ConsentProvider } from '@/lib/consent/ConsentProvider'
import { SerwistProvider } from './serwist-provider'

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
  themeColor: '#f5f9f9',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover', // Safe-Area (Notch/Dynamic Island) nutzen, damit env(safe-area-inset-*) wirkt
}

const BOOT_SPLASH_CSS = `
html,body{background:#f5f9f9;color:#1c1c1c;margin:0;min-height:100%}
#anidocs-boot-splash{
  position:fixed;inset:0;z-index:100000;
  display:flex;align-items:center;justify-content:center;
  background:#f5f9f9;
  transition:opacity .35s ease;
}
#anidocs-boot-splash.anidocs-boot-splash--hide{opacity:0;pointer-events:none}
#anidocs-boot-splash .anidocs-boot-logo{
  width:96px;height:96px;position:relative;display:inline-block;
}
#anidocs-boot-splash .anidocs-boot-logo svg{width:100%;height:100%;display:block}
#anidocs-boot-splash .anidocs-boot-box{
  fill:#006d6d;transform-origin:center;
  animation:anidocs-boot-breathe 1.6s ease-in-out infinite;
}
#anidocs-boot-splash .anidocs-boot-letter{
  fill:#fff;transform-origin:center;
  animation:anidocs-boot-letter 1.6s ease-in-out infinite;
}
@keyframes anidocs-boot-breathe{0%,100%{transform:scale(.86)}50%{transform:scale(1.04)}}
@keyframes anidocs-boot-letter{0%,100%{transform:scale(1);opacity:.95}50%{transform:scale(.94);opacity:1}}
@media (prefers-reduced-motion:reduce){
  #anidocs-boot-splash .anidocs-boot-box,
  #anidocs-boot-splash .anidocs-boot-letter{animation:none}
}
`

const BOOT_SPLASH_HTML = `
<div id="anidocs-boot-splash" role="status" aria-live="polite" aria-busy="true" aria-label="AniDocs wird geladen">
  <div class="anidocs-boot-logo">
    <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect class="anidocs-boot-box" x="1" y="1" width="58" height="58" rx="13.42" ry="13.42"></rect>
      <path class="anidocs-boot-letter" d="M32.19,24.84v1.07c-0.4-0.34-0.86-0.63-1.38-0.86c-0.83-0.36-1.75-0.54-2.76-0.54c-1.49,0-2.82,0.36-3.98,1.07s-2.07,1.7-2.73,2.97c-0.66,1.27-0.99,2.72-0.99,4.34c0,1.6,0.33,3.03,0.99,4.29c0.66,1.26,1.57,2.25,2.73,2.97c1.16,0.72,2.49,1.09,3.98,1.09c1.01,0,1.93-0.19,2.76-0.56c0.52-0.23,0.98-0.53,1.38-0.87v1.1h5.62V24.84H32.19zM29.27,36.14c-0.59,0-1.13-0.14-1.61-0.43c-0.48-0.28-0.85-0.67-1.12-1.17c-0.26-0.49-0.39-1.06-0.39-1.69c0-0.61,0.14-1.17,0.41-1.66c0.27-0.49,0.65-0.88,1.12-1.17c0.47-0.28,1.01-0.43,1.63-0.43c0.61,0,1.16,0.14,1.63,0.43c0.47,0.28,0.84,0.67,1.1,1.15c0.26,0.48,0.39,1.04,0.39,1.68c0,0.96-0.29,1.75-0.87,2.37C30.97,35.84,30.21,36.14,29.27,36.14z"></path>
    </svg>
  </div>
</div>
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de">
      <head>
        {/* Erste Pixel + Boot-Splash ohne auf React/CSS-Bundle zu warten */}
        <style dangerouslySetInnerHTML={{ __html: BOOT_SPLASH_CSS }} />
        <link rel="preload" href="/icon.png" as="image" />
      </head>
      <body>
        <div dangerouslySetInnerHTML={{ __html: BOOT_SPLASH_HTML }} />
        <ConsentProvider>
          <CookieConsentLayerGate />
          <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV === 'development'}>
            <AnidocsAppLoader />
            {children}
          </SerwistProvider>
        </ConsentProvider>
      </body>
    </html>
  )
}