import Link from 'next/link'
import type { DirectoryPublicAnimalTypeRow, DirectoryPublicSpecialtyRow } from '@/lib/directory/public/types'
import type { BehandlerListingQuery } from '@/lib/directory/public/listingParams'
import { directorySpecialtyDisplayName } from '@/lib/directory/public/labels'
import { RADIUS_KM_OPTIONS } from '@/lib/directory/public/listingParams'

function IconGeo() {
  return (
    <svg className="dir-hero-icon" width={16} height={16} viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M8 1.5a4.25 4.25 0 0 0-4.25 4.25c0 3.18 4.25 7.87 4.25 7.87s4.25-4.69 4.25-7.87A4.25 4.25 0 0 0 8 1.5Zm0 5.75a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"
      />
    </svg>
  )
}

function IconPulse() {
  return (
    <svg className="dir-hero-icon" width={16} height={16} viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2Zm.75 3.25-.5 2h1.5l-.5 2.5H8.5l-.25 1.25H7.75L8 9.75H6.5l.75-3.75h1.5Z"
      />
    </svg>
  )
}

function IconPaw() {
  return (
    <svg className="dir-hero-icon" width={16} height={16} viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M5.5 5.25a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm7 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM4 8.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm10 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM8 6.5a2 2 0 0 0-2 2c0 1.5 1 3 2 3.5 1-.5 2-2 2-3.5a2 2 0 0 0-2-2Z"
      />
    </svg>
  )
}

function IconBriefcase() {
  return (
    <svg className="dir-hero-icon" width={16} height={16} viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M3 4.5A1.5 1.5 0 0 1 4.5 3h7A1.5 1.5 0 0 1 13 4.5V6h1v7.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5V6h1V4.5Zm1 0V6h8V4.5a.5.5 0 0 0-.5-.5h-7a.5.5 0 0 0-.5.5ZM3 7v6.5a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V7H3Z"
      />
    </svg>
  )
}

function IconCrosshair() {
  return (
    <svg className="dir-hero-icon" width={16} height={16} viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M8 0a.5.5 0 0 1 .5.5v.79a4.97 4.97 0 0 1 4.21 4.21h.79a.5.5 0 0 1 0 1h-.79a4.97 4.97 0 0 1-4.21 4.21v.79a.5.5 0 0 1-1 0v-.79a4.97 4.97 0 0 1-4.21-4.21H.5a.5.5 0 0 1 0-1h.79A4.97 4.97 0 0 1 7.21 1.29V.5A.5.5 0 0 1 8 0zm-2.86 5H2.5a.5.5 0 0 0 0 1h2.64A4.97 4.97 0 0 1 5.05 8 4.97 4.97 0 0 1 3.14 9.5H.5a.5.5 0 0 0 0 1h2.64a4.97 4.97 0 0 1 4.21 4.21v.79a.5.5 0 0 0 1 0v-.79a4.97 4.97 0 0 1 4.21-4.21h2.64a.5.5 0 0 0 0-1h-2.64a4.97 4.97 0 0 1-4.21-4.21V.5a.5.5 0 0 0-1 0v.79A4.97 4.97 0 0 1 5.14 5z"
      />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg className="dir-hero-icon" width={18} height={18} viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M11.7 10.3 14 12.6l-1.4 1.4-2.3-2.3a5.5 5.5 0 1 1 1.4-1.4Zm-4.2.7a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
      />
    </svg>
  )
}

export function DirectoryListingHero({
  heroImageSrc,
  specialties,
  animalTypes,
  values,
}: {
  heroImageSrc: string | null
  specialties: DirectoryPublicSpecialtyRow[]
  animalTypes: DirectoryPublicAnimalTypeRow[]
  values: BehandlerListingQuery
}) {
  return (
    <div className="dir-hero" data-directory-section="hero">
      <div className="dir-hero__img-wrap">
        {heroImageSrc ? (
          <img
            src={heroImageSrc}
            alt=""
            className="dir-hero__img"
            decoding="async"
            fetchPriority="high"
          />
        ) : (
          <div className="dir-hero__img dir-hero__img--placeholder" aria-hidden />
        )}
      </div>
      <div className="dir-hero__bottom">
        <h1 className="dir-hero__title font-[family-name:var(--font-outfit)]">Finde den passenden Behandler für dein Tier</h1>
        <p className="dir-hero__sub">
          Tierphysiotherapeuten, Osteopathen, Tierheilpraktiker und Hufbearbeiter in deiner Nähe — nur veröffentlichte Profile.
        </p>
        <div className="dir-hero__search-wrap">
          <form method="get" action="/behandler" className="dir-search-card">
            <div className="dir-search-card__field">
              <IconGeo />
              <input
                name="location"
                type="search"
                autoComplete="address-level2"
                defaultValue={values.location}
                placeholder="Ort oder PLZ…"
                aria-label="Ort oder PLZ"
              />
            </div>
            <div className="dir-search-card__field">
              <IconCrosshair />
              <select name="radiusKm" defaultValue={String(values.radiusKm)} aria-label="Suchradius">
                {RADIUS_KM_OPTIONS.map((km) => (
                  <option key={km} value={km}>
                    {km} km
                  </option>
                ))}
              </select>
            </div>
            <div className="dir-search-card__field">
              <IconPulse />
              <select name="specialtyId" defaultValue={values.specialtyId} aria-label="Fachrichtung">
                <option value="">Alle Fachrichtungen</option>
                {specialties.map((s) => (
                  <option key={s.id} value={s.id}>
                    {directorySpecialtyDisplayName(s.code, s.name)}
                  </option>
                ))}
              </select>
            </div>
            <div className="dir-search-card__field">
              <IconPaw />
              <select name="animalTypeId" defaultValue={values.animalTypeId} aria-label="Tierart">
                <option value="">Alle Tierarten</option>
                {animalTypes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="dir-search-card__field dir-search-card__field--narrow">
              <IconBriefcase />
              <select name="serviceType" defaultValue={values.serviceType} aria-label="Angebotsform">
                <option value="">Alle (Praxis &amp; mobil)</option>
                <option value="stationary">Nur Praxis</option>
                <option value="mobile">Nur mobil</option>
                <option value="both">Praxis &amp; mobil</option>
              </select>
            </div>
            <button type="submit" className="dir-search-card__btn">
              <IconSearch />
              Suchen
            </button>
          </form>
          <p className="dir-hero__reset">
            <Link href="/behandler" className="dir-hero__reset-link">
              Alle Filter zurücksetzen
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
