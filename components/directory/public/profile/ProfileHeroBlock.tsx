import type {
  DirectoryPublicAnimalTypeRow,
  DirectoryPublicProfileRow,
  DirectoryPublicSpecialtyRow,
} from '@/lib/directory/public/types'
import { profileInitials, publicProfileStreetLine } from '@/lib/directory/public/profileDisplay'

export function ProfileHeroBlock({
  profile,
  specialties,
  animalTypes,
  heroImageUrl,
}: {
  profile: DirectoryPublicProfileRow
  specialties: DirectoryPublicSpecialtyRow[]
  animalTypes: DirectoryPublicAnimalTypeRow[]
  heroImageUrl: string | null
}) {
  const plzOrt = [profile.postal_code, profile.city].filter(Boolean).join(' ').trim()
  const streetLine = publicProfileStreetLine(profile)
  const locationLine = [streetLine, plzOrt].filter(Boolean).join(' · ') || plzOrt
  const stateLine = profile.state
  const locationReadable = [locationLine, stateLine].filter(Boolean).join(', ')
  const specialtiesLine =
    specialties.length > 0
      ? [...specialties]
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((s) => s.name.trim())
          .filter(Boolean)
          .join(' · ')
      : null
  const practiceExtra =
    profile.practice_name?.trim() &&
    profile.practice_name.trim().toLowerCase() !== profile.display_name.trim().toLowerCase()
      ? profile.practice_name.trim()
      : null

  const st = profile.service_type
  const topActive = Boolean(profile.top_active)

  return (
    <header className="dir-prof-v2-hero" data-directory-block="hero">
      <div className="dir-prof-v2-hero-in">
        <div
          className={`dir-prof-v2-h-av${heroImageUrl ? ' dir-prof-v2-h-av--logo' : ' dir-prof-v2-h-av--init'}`}
          aria-hidden={heroImageUrl ? undefined : true}
        >
          {heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- öffentliche Medien-URL
            <img src={heroImageUrl} alt={profile.display_name} className="dir-prof-v2-h-av-img" />
          ) : (
            <span className="dir-prof-v2-h-av-init">{profileInitials(profile.display_name)}</span>
          )}
        </div>

        <div className="dir-prof-v2-hero-body">
          {topActive ? (
            <div className="dir-prof-v2-hero-head">
              <div className="dir-prof-v2-h-top">
                <i className="bi bi-gem" aria-hidden />
                Top-Profil
              </div>
            </div>
          ) : null}

          {practiceExtra ? <div className="dir-prof-v2-h-prac">{practiceExtra}</div> : null}

          <h1 className="dir-prof-v2-h-name">{profile.display_name}</h1>

          {specialtiesLine ? <div className="dir-prof-v2-h-fach">{specialtiesLine}</div> : null}

          {locationReadable ? (
            <div className="dir-prof-v2-h-loc">
              <i className="bi bi-geo-alt-fill" aria-hidden />
              {locationReadable}
            </div>
          ) : null}

          <div className="dir-prof-v2-h-tags">
            {st === 'mobile' || st === 'both' ? (
              <span className="dir-prof-v2-ht dir-prof-v2-ht--svc">
                <i className="bi bi-car-front-fill" aria-hidden />
                Mobil
              </span>
            ) : null}
            {st === 'stationary' || st === 'both' ? (
              <span className="dir-prof-v2-ht dir-prof-v2-ht--svc">
                <i className="bi bi-building" aria-hidden />
                Praxis
              </span>
            ) : null}
            {animalTypes.map((a) => (
              <span key={a.id} className="dir-prof-v2-ht dir-prof-v2-ht--ani">
                {a.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </header>
  )
}
