import Link from 'next/link'

import type { ProfileTaxonomyLabels } from '@/lib/directory/public/data'
import type {
  DirectoryPublicAnimalTypeRow,
  DirectoryPublicProfileRow,
  DirectoryPublicSpecialtyRow,
} from '@/lib/directory/public/types'
import { buildBehandlerListingHref, DEFAULT_RADIUS_KM } from '@/lib/directory/public/listingParams'
import type { BehandlerListingQuery } from '@/lib/directory/public/listingParams'
import { listingQueryWithBarhufDefaultAnimal } from '@/lib/directory/public/taxonomyCoherence'

import { DirectoryCategoryCardIcon } from '@/components/directory/public/listing/DirectoryCategoryCardIcon'
import { DirectoryFeaturedSlider } from '@/components/directory/public/listing/DirectoryFeaturedSlider'
import { directoryAboutUrl, directoryProfileCreateHref } from '@/lib/directory/public/appBaseUrl'
import { directorySpecialtyDisplayName } from '@/lib/directory/public/labels'

function categoryDisplayName(code: string, dbName: string): string {
  if (code === 'tierheilpraktik') return 'Tierheilpraktik'
  return dbName
}

/** Wenn die DB (noch) keine kanonischen Fachrichtungen liefert — gleiche vier Karten wie im HTML-Mock. */
const STATIC_CATEGORY_FALLBACK: { code: string; name: string }[] = [
  { code: 'tierphysiotherapie', name: 'Tierphysiotherapie' },
  { code: 'tierosteopathie', name: 'Tierosteopathie' },
  { code: 'tierheilpraktik', name: 'Tierheilpraktik' },
  { code: 'hufschmied', name: 'Hufschmied' },
  { code: 'barhufbearbeitung', name: 'Barhufbearbeitung' },
  { code: 'pferdedentist', name: 'Pferdedentist' },
]

export function DirectoryListingHomeBlocks({
  categories,
  animalTypes,
  countsBySpecialtyId,
  featuredProfiles,
  taxonomyByProfileId,
  listingQuery,
  showMarketingBlocks,
}: {
  categories: DirectoryPublicSpecialtyRow[]
  animalTypes: DirectoryPublicAnimalTypeRow[]
  countsBySpecialtyId: Map<string, number>
  featuredProfiles: DirectoryPublicProfileRow[]
  taxonomyByProfileId: Map<string, ProfileTaxonomyLabels>
  listingQuery: BehandlerListingQuery
  /** Featured / How / CTA / Trust — nur auf der ungefilterten Startansicht. */
  showMarketingBlocks: boolean
}) {
  const profileCreateHref = directoryProfileCreateHref()
  const aboutHref = directoryAboutUrl()
  const qBase: BehandlerListingQuery = {
    ...listingQuery,
    location: '',
    radiusKm: DEFAULT_RADIUS_KM,
    animalTypeId: '',
    serviceType: '',
    page: 1,
  }
  const gridRows =
    categories.length > 0
      ? categories.map((s) => ({
          key: s.id,
          code: s.code,
          name: categoryDisplayName(s.code, directorySpecialtyDisplayName(s.code, s.name)),
          href: buildBehandlerListingHref(
            listingQueryWithBarhufDefaultAnimal({ ...qBase, specialtyId: s.id, page: 1 }, categories, animalTypes),
            1
          ),
          count: countsBySpecialtyId.get(s.id) ?? 0,
        }))
      : STATIC_CATEGORY_FALLBACK.map((s) => ({
          key: `fallback-${s.code}`,
          code: s.code,
          name: s.name,
          href: '/behandler',
          count: null as number | null,
        }))

  return (
    <>
      <div className="categories" data-directory-section="categories">
        <div className="hero-tag">
          <i className="bi bi-heart-pulse-fill" aria-hidden />
          Fachrichtungen
        </div>
        <div className="section-title">Welche Behandlung suchst du?</div>
        <p className="categories-subtitle">
          Wähle eine Fachrichtung und finde spezialisierte Tierbehandler in deiner Nähe.
        </p>
        <div className="cat-grid">
          {gridRows.map((row) => (
            <Link key={row.key} href={row.href} className="cat-card">
              <div className="cat-icon">
                <DirectoryCategoryCardIcon code={row.code} />
              </div>
              <div className="cat-name">{row.name}</div>
              <div className="cat-count">
                {row.count === null
                  ? '0 Behandler'
                  : `${row.count} ${row.count === 1 ? 'Behandler' : 'Behandler'}`}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {showMarketingBlocks ? (
        <DirectoryFeaturedSlider profiles={featuredProfiles} taxonomyByProfileId={taxonomyByProfileId} />
      ) : null}

      {showMarketingBlocks ? (
        <>
          <div className="how" data-directory-section="how">
            <div style={{ textAlign: 'center' }}>
              <div className="hero-tag" style={{ marginBottom: 12 }}>
                <i className="bi bi-check-circle-fill" aria-hidden />
                So funktioniert es
              </div>
              <div className="section-title">In drei Schritten zum Behandler</div>
            </div>
            <div className="how-grid">
              <div className="how-step">
                <div className="how-num">1</div>
                <div className="how-title">Behandler suchen</div>
                <div className="how-desc">
                  Gib deinen Ort und die gewünschte Fachrichtung ein. Filtere nach Tierart und Umkreis.
                </div>
              </div>
              <div className="how-step">
                <div className="how-num">2</div>
                <div className="how-title">Profil ansehen</div>
                <div className="how-desc">
                  Informiere dich über Leistungen, Qualifikationen und Bewertungen anderer Tierhalter.
                </div>
              </div>
              <div className="how-step">
                <div className="how-num">3</div>
                <div className="how-title">Kontakt aufnehmen</div>
                <div className="how-desc">Schreib eine Anfrage oder ruf direkt an. Vereinbare einen Termin.</div>
              </div>
            </div>
          </div>

          <div className="cta-outer">
            <div className="cta-banner">
              <div className="cta-info">
                <h2 className="cta-title">Bist du Tierbehandler?</h2>
                <p className="cta-desc">
                  Werde sichtbar für Tierhalter in deiner Region. Erstelle dein Profil kostenlos und gewinne neue Kunden
                  über anidocs.
                </p>
              </div>
              <div className="cta-actions">
                <a href={profileCreateHref} className="cta-btn-primary">
                  Profil erstellen
                </a>
                <a href={aboutHref} className="cta-btn-secondary">
                  Mehr erfahren
                </a>
              </div>
            </div>
          </div>

          <div className="trust" data-directory-section="trust">
            <span className="trust-item">
              <i className="bi bi-patch-check-fill" aria-hidden />
              Verifizierte Profile
            </span>
            <span className="trust-item">
              <i className="bi bi-star-fill" aria-hidden />
              Echte Bewertungen
            </span>
            <span className="trust-item">
              <i className="bi bi-shield-check" aria-hidden />
              Kostenlos für Tierhalter
            </span>
            <span className="trust-item">
              <i className="bi bi-geo-alt-fill" aria-hidden />
              Regionale Suche
            </span>
          </div>
        </>
      ) : null}
    </>
  )
}
