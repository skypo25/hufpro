import Link from 'next/link'
import type { ProfileTaxonomyLabels } from '@/lib/directory/public/data'
import type { DirectoryPublicProfileRow } from '@/lib/directory/public/types'

const AVATAR_BACKGROUNDS = [
  'var(--dir-avatar-blue)',
  'var(--dir-avatar-purple)',
  'var(--dir-avatar-orange)',
  'var(--dir-avatar-accent)',
  'var(--dir-avatar-muted)',
] as const

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const a = parts[0][0]
    const b = parts[parts.length - 1][0]
    return `${a}${b}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase() || '?'
}

function avatarBgForSlug(slug: string): string {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h + slug.charCodeAt(i) * (i + 1)) % 997
  return AVATAR_BACKGROUNDS[h % AVATAR_BACKGROUNDS.length]
}

export function DirectoryProfileCard({
  profile,
  taxonomy,
  distanceKm,
}: {
  profile: DirectoryPublicProfileRow
  taxonomy?: ProfileTaxonomyLabels
  /** Entfernung zum Suchpunkt (nur Umkreissuche). */
  distanceKm?: number | null
}) {
  const location = [profile.postal_code, profile.city].filter(Boolean).join(' ')
  const locLabel = [location, profile.state].filter(Boolean).join(' · ') || null
  const primaryFach =
    taxonomy?.specialties?.length ? taxonomy.specialties[0] : 'Tierbehandler:in'

  const animals = taxonomy?.animals ?? []
  const specs = taxonomy?.specialties ?? []
  const extraSpecs = specs.length > 1 ? specs.slice(1, 3) : []

  const href = `/behandler/${profile.slug}`
  const avatarBg = avatarBgForSlug(profile.slug)
  const initials = initialsFromName(profile.display_name)

  return (
    <Link href={href} className="dir-prac-card" data-directory-card>
      <div className="dir-prac-card__header">
        <div
          className="dir-prac-card__avatar"
          style={{ background: avatarBg }}
          aria-hidden
        >
          {initials}
        </div>
        <div className="dir-prac-card__info">
          <div className="dir-prac-card__name">{profile.display_name}</div>
          <div className="dir-prac-card__fach">{primaryFach}</div>
          <div className="dir-prac-card__loc">
            <i className="bi bi-geo-alt-fill" aria-hidden />
            {locLabel ?? 'Ort folgt'}
            {distanceKm != null && Number.isFinite(distanceKm) ? (
              <span className="dir-prac-card__distance"> · ca. {distanceKm} km</span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="dir-prac-card__body">
        <div className="dir-prac-card__tags">
          {animals.map((a) => (
            <span key={a} className="dir-tag dir-tag--tier">
              {a}
            </span>
          ))}
          {extraSpecs.map((s) => (
            <span key={s} className="dir-tag dir-tag--art">
              {s}
            </span>
          ))}
          {profile.service_type === 'mobile' ? (
            <span className="dir-tag dir-tag--mobil">Mobil</span>
          ) : null}
          {profile.service_type === 'stationary' ? (
            <span className="dir-tag dir-tag--praxis">Praxis</span>
          ) : null}
          {profile.service_type === 'both' ? (
            <>
              <span className="dir-tag dir-tag--mobil">Mobil</span>
              <span className="dir-tag dir-tag--praxis">Praxis</span>
            </>
          ) : null}
        </div>
        {profile.short_description ? (
          <p className="dir-prac-card__teaser">{profile.short_description}</p>
        ) : null}
      </div>
      <div className="dir-prac-card__footer">
        <span className="dir-prac-card__btn dir-prac-card__btn--primary">Profil ansehen</span>
      </div>
    </Link>
  )
}
