import type { NextConfig } from 'next'
import { withSerwist } from '@serwist/turbopack'

const nextConfig: NextConfig = {
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
    return [{ source: '/auth/confirm', destination: '/auth/callback' }]
  },
}

export default withSerwist(nextConfig)
