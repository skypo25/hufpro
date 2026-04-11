/** ISO-3166-1 alpha-2 für D-A-CH (öffentliche Profile). */
export function countryDachLabel(country: string | null | undefined): string {
  const c = (country ?? '').toString().toUpperCase()
  if (c === 'DE') return 'Deutschland'
  if (c === 'AT') return 'Österreich'
  if (c === 'CH') return 'Schweiz'
  return c || '—'
}

export function serviceTypeLabel(t: string): string {
  switch (t) {
    case 'mobile':
      return 'Mobil'
    case 'stationary':
      return 'Praxis'
    case 'both':
      return 'Praxis & mobil'
    default:
      return t
  }
}

export function socialPlatformLabel(platform: string): string {
  switch (platform) {
    case 'website':
      return 'Website'
    case 'instagram':
      return 'Instagram'
    case 'facebook':
      return 'Facebook'
    case 'linkedin':
      return 'LinkedIn'
    case 'youtube':
      return 'YouTube'
    case 'tiktok':
      return 'TikTok'
    default:
      return platform
  }
}

/** Bootstrap Icons class (bi …) für Social-Buttons */
export function socialPlatformIconClass(platform: string): string {
  switch (platform) {
    case 'website':
      return 'bi-globe2'
    case 'instagram':
      return 'bi-instagram'
    case 'facebook':
      return 'bi-facebook'
    case 'linkedin':
      return 'bi-linkedin'
    case 'youtube':
      return 'bi-youtube'
    case 'tiktok':
      return 'bi-camera-reels'
    default:
      return 'bi-link-45deg'
  }
}
