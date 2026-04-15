import { DirectoryPublicChrome } from '@/components/directory/public/DirectoryPublicChrome'

export function DirectoryPublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="dir-site-shell dir-site-shell--public min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased">
      <DirectoryPublicChrome>{children}</DirectoryPublicChrome>
    </div>
  )
}
