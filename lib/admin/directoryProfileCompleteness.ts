import 'server-only'

export type DirectoryProfileCompleteness = {
  /** 0–100 */
  score: number
  passed: number
  total: number
  checks: { key: string; ok: boolean; label: string }[]
}

type ProfileFields = {
  short_description: string | null
  description: string | null
}

export function computeDirectoryProfileCompleteness(args: {
  profile: ProfileFields
  methodCount: number
  animalTypeCount: number
  mediaLogoOrPhotoCount: number
  socialLinkCount: number
}): DirectoryProfileCompleteness {
  const hasShort = Boolean((args.profile.short_description ?? '').trim())
  const hasDesc = Boolean((args.profile.description ?? '').trim())
  const hasMethods = args.methodCount > 0
  const hasAnimals = args.animalTypeCount > 0
  const hasImage = args.mediaLogoOrPhotoCount > 0
  const hasSocial = args.socialLinkCount > 0

  const checks = [
    { key: 'image', ok: hasImage, label: 'Bild/Logo' },
    { key: 'short_description', ok: hasShort, label: 'Kurzbeschreibung' },
    { key: 'description', ok: hasDesc, label: 'Beschreibung' },
    { key: 'methods', ok: hasMethods, label: 'Methoden' },
    { key: 'animal_types', ok: hasAnimals, label: 'Tierarten' },
    { key: 'social', ok: hasSocial, label: 'Social/Web' },
  ] as const

  const passed = checks.filter((c) => c.ok).length
  const total = checks.length
  const score = Math.round((passed / total) * 100)

  return { score, passed, total, checks: checks.map((c) => ({ ...c })) }
}
