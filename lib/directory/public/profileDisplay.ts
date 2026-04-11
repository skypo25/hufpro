const AVATAR_BACKGROUNDS = [
  'var(--dir-avatar-blue)',
  'var(--dir-avatar-purple)',
  'var(--dir-avatar-orange)',
  'var(--dir-avatar-accent)',
  'var(--dir-avatar-muted)',
] as const

export function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const a = parts[0][0]
    const b = parts[parts.length - 1]![0]
    return `${a}${b}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase() || '?'
}

export function profileAvatarBackground(slug: string): string {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h + slug.charCodeAt(i) * (i + 1)) % 997
  return AVATAR_BACKGROUNDS[h % AVATAR_BACKGROUNDS.length]!
}

/** Eine Zeile für die öffentliche Adresse: Straße + Hausnummer (Import trennt die Felder). */
export function publicProfileStreetLine(profile: {
  street?: string | null
  house_number?: string | null
}): string | null {
  const line = [profile.street?.trim(), profile.house_number?.trim()].filter(Boolean).join(' ').trim()
  return line || null
}

/** Kurzinfo-Kartenkopf: Firmenname, sonst Vor- + Nachname, sonst display_name. */
export function publicProfileSidebarCardTitle(profile: {
  display_name: string
  practice_name?: string | null
  first_name?: string | null
  last_name?: string | null
}): string {
  const pn = profile.practice_name?.trim() ?? ''
  if (pn) return pn
  const fn = profile.first_name?.trim() ?? ''
  const ln = profile.last_name?.trim() ?? ''
  const person = [fn, ln].filter(Boolean).join(' ').trim()
  if (person) return person
  return profile.display_name?.trim() || 'Profil'
}

/** DE: ein Fach, zwei mit „und“, drei+ mit Kommas und „und“ vor dem letzten. */
function formatSpecialtyListGerman(names: string[]): string {
  const n = names.map((s) => s.trim()).filter(Boolean)
  if (n.length === 0) return ''
  if (n.length === 1) return n[0]!
  if (n.length === 2) return `${n[0]} und ${n[1]}`
  return `${n.slice(0, -1).join(', ')} und ${n[n.length - 1]}`
}

/**
 * Zweite Zeile unter dem Kartenkopf: Fächer mit „und“ / Kommaliste, „in Ort“ ohne PLZ (nur Stadt, sonst Bundesland).
 * `specialtyNames` in gewünschter Reihenfolge (z. B. Primärfach zuerst).
 */
export function publicProfileSidebarCardTagline(
  profile: { postal_code?: string | null; city?: string | null; state?: string | null },
  specialtyNames: string[]
): string | null {
  const location = profile.city?.trim() || profile.state?.trim() || ''
  if (!location) return null
  const specPart = formatSpecialtyListGerman(specialtyNames)
  if (specPart) return `${specPart} in ${location}`
  return location
}
