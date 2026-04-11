import type { Metadata } from 'next'
import { DirectoryPublicShell } from '@/components/directory/public/DirectoryPublicShell'

/**
 * Öffentlicher Verzeichnisbereich — getrennt von (app) und (auth).
 * optionales metadataBase für SEO auf Marketing-Domain (ohne Root-Layout zu ändern).
 */
function resolveDirectoryMetadataBase(): URL | undefined {
  const raw =
    process.env.NEXT_PUBLIC_DIRECTORY_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!raw) return undefined
  const u = raw.startsWith('http') ? raw : `https://${raw}`
  try {
    return new URL(u.replace(/\/+$/, ''))
  } catch {
    return undefined
  }
}

const directoryMetadataBase = resolveDirectoryMetadataBase()

export const metadata: Metadata = {
  ...(directoryMetadataBase ? { metadataBase: directoryMetadataBase } : {}),
}

export default function DirectoryRouteGroupLayout({ children }: { children: React.ReactNode }) {
  return <DirectoryPublicShell>{children}</DirectoryPublicShell>
}
