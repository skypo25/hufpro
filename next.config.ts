import type { NextConfig } from 'next'
import { withSerwist } from '@serwist/turbopack'

const nextConfig: NextConfig = {
  /** Verzeichnis-Wizard: Logo + mehrere Galerie-Fotos per Server Action (FormData) — Standard 1 MB reicht nicht. */
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
  images: {
    // Default in Next 16 is only `{ pathname: '**', search: '' }` → no query strings on local src.
    // Hero unter /directory/ nutzt `?v=mtime` als Cache-Buster (siehe resolveBehandlerHeroSrc).
    localPatterns: [{ pathname: '/directory/**' }, { pathname: '**', search: '' }],
  },
  serverExternalPackages: ['@react-pdf/renderer'],
  // Siehe DOCS/code-audit.md: @react-jvectormap/world unterstützt React 19 nicht → entfernt werden, bevor ignoreBuildErrors deaktiviert werden kann
  typescript: { ignoreBuildErrors: true },
  async redirects() {
    return [
      {
        source: '/horses/:path*',
        destination: '/animals/:path*',
        permanent: true,
      },
    ]
  },
  /** E-Mail-Templates nutzen oft /auth/confirm; die App verarbeitet unter /auth/callback. */
  async rewrites() {
    return [
      { source: '/auth/confirm', destination: '/auth/callback' },
      // Klassischer SW-Pfad; Serwist liefert unter /serwist/sw.js (vermeidet 404 bei alter Registrierung/Tools).
      { source: '/sw.js', destination: '/serwist/sw.js' },
    ]
  },
}

export default withSerwist(nextConfig)
