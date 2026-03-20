import type { NextConfig } from 'next'
import { withSerwist } from '@serwist/turbopack'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@react-pdf/renderer'],
  typescript: { ignoreBuildErrors: true }, // Entfernen, sobald Projekt-TS-Fehler behoben
}

export default withSerwist(nextConfig)
