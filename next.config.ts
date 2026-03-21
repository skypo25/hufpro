import type { NextConfig } from 'next'
import { withSerwist } from '@serwist/turbopack'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@react-pdf/renderer'],
  // Siehe DOCS/code-audit.md: @react-jvectormap/world unterstützt React 19 nicht → entfernt werden, bevor ignoreBuildErrors deaktiviert werden kann
  typescript: { ignoreBuildErrors: true },
}

export default withSerwist(nextConfig)
