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
}

export default withSerwist(nextConfig)
