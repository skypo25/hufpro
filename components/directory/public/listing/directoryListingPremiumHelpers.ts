export const DIRECTORY_PREMIUM_AVATAR_PALETTE = [
  { bg: 'rgba(82,183,136,.12)', fg: '#154226' },
  { bg: 'rgba(139,92,246,.08)', fg: '#8B5CF6' },
  { bg: 'rgba(249,115,22,.08)', fg: '#F97316' },
  { bg: 'rgba(59,130,246,.08)', fg: '#3B82F6' },
  { bg: 'rgba(236,72,153,.08)', fg: '#EC4899' },
] as const

export function directoryPremiumInitialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase() || '?'
}

export function directoryPremiumAvatarColorsForSlug(
  slug: string
): (typeof DIRECTORY_PREMIUM_AVATAR_PALETTE)[number] {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h + slug.charCodeAt(i) * (i + 1)) % 997
  return DIRECTORY_PREMIUM_AVATAR_PALETTE[h % DIRECTORY_PREMIUM_AVATAR_PALETTE.length]
}

export function directoryPremiumIsNewProfile(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false
  const t = new Date(createdAt).getTime()
  if (!Number.isFinite(t)) return false
  const age = Date.now() - t
  return age >= 0 && age < 21 * 86400000
}
