import type { DirectoryPublicProfileRow } from '@/lib/directory/public/types'
import type { ProfileTaxonomyLabels } from '@/lib/directory/public/data'
import { DirectoryProfileCard } from '@/components/directory/public/DirectoryProfileCard'

export function DirectoryListingResultsGrid({
  profiles,
  taxonomyByProfileId,
  distancesKmByProfileId,
}: {
  profiles: DirectoryPublicProfileRow[]
  taxonomyByProfileId: Map<string, ProfileTaxonomyLabels>
  distancesKmByProfileId?: Map<string, number>
}) {
  return (
    <ul className="dir-prac-grid" data-directory-section="results" aria-label="Suchergebnisse">
      {profiles.map((p) => (
        <li key={p.id}>
          <DirectoryProfileCard
            profile={p}
            taxonomy={taxonomyByProfileId.get(p.id)}
            distanceKm={distancesKmByProfileId?.get(p.id) ?? null}
          />
        </li>
      ))}
    </ul>
  )
}
