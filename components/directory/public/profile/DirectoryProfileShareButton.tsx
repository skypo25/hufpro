'use client'

type Props = {
  className?: string
  url: string
  title: string
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
}

export function DirectoryProfileShareButton({
  className = '',
  url,
  title,
  children,
  variant = 'secondary',
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
            return
          }
          await navigator.clipboard.writeText(url)
        } catch {
          /* user cancelled or clipboard denied */
        }
      }}
    >
      {children}
    </button>
  )
}
