'use client'

type Props = {
  className?: string
  url: string
  title: string
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
  /** Wenn gesetzt: ein „Teilen“-Ereignis nach erfolgreichem Share oder Kopieren. */
  analyticsSlug?: string
}

export function DirectoryProfileShareButton({
  className = '',
  url,
  title,
  children,
  variant = 'secondary',
  analyticsSlug,
}: Props) {
  const base =
    variant === 'primary'
      ? 'dir-prof-v2-ha dir-prof-v2-ha--p'
      : 'dir-prof-v2-ha dir-prof-v2-ha--s'

  return (
    <button
      type="button"
      className={`${base} ${className}`.trim()}
      onClick={async () => {
        try {
          if (typeof navigator !== 'undefined' && navigator.share) {
            await navigator.share({ title, url })
          } else {
            await navigator.clipboard.writeText(url)
          }
          if (analyticsSlug) {
            void fetch('/api/directory/profile-analytics', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ slug: analyticsSlug, event: 'share' }),
              keepalive: true,
            }).catch(() => {})
          }
        } catch {
          /* user cancelled or clipboard denied */
        }
      }}
    >
      {children}
    </button>
  )
}
