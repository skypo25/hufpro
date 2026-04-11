import { DM_Sans, Outfit } from 'next/font/google'

import { DirectoryPublicChrome } from '@/components/directory/public/DirectoryPublicChrome'

const directorySans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-directory-sans',
  display: 'swap',
})

const directoryDisplay = Outfit({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-directory-display',
  display: 'swap',
})

export function DirectoryPublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`dir-site-shell dir-site-shell--public min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased ${directorySans.variable} ${directoryDisplay.variable}`}
    >
      <DirectoryPublicChrome>{children}</DirectoryPublicChrome>
    </div>
  )
}
