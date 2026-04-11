import Link from 'next/link'
import type { BehandlerListingQuery } from '@/lib/directory/public/listingParams'
import {
  behandlerQueryWithServiceType,
  buildBehandlerListingHref,
} from '@/lib/directory/public/listingParams'

export function DirectoryListingQuickFilters({
  query,
  totalCount,
}: {
  query: BehandlerListingQuery
  totalCount: number
}) {
  const qAll = behandlerQueryWithServiceType(query, '')
  const qMobile = behandlerQueryWithServiceType(query, 'mobile')
  const qStationary = behandlerQueryWithServiceType(query, 'stationary')
  const qBoth = behandlerQueryWithServiceType(query, 'both')

  const activeAll = !query.serviceType
  const activeMobile = query.serviceType === 'mobile'
  const activeStationary = query.serviceType === 'stationary'
  const activeBoth = query.serviceType === 'both'

  return (
    <div className="dir-filter-row" data-directory-section="quick-filters">
      <Link
        href={buildBehandlerListingHref(qAll, 1)}
        className={`dir-filter-chip${activeAll ? ' dir-filter-chip--active' : ''}`}
      >
        <i className="bi bi-grid-fill" aria-hidden />
        Alle
      </Link>
      <span className="dir-filter-chip dir-filter-chip--soon" title="Folgt">
        <i className="bi bi-patch-check-fill" aria-hidden />
        Verifiziert
      </span>
      <Link
        href={buildBehandlerListingHref(qMobile, 1)}
        className={`dir-filter-chip${activeMobile ? ' dir-filter-chip--active' : ''}`}
      >
        <i className="bi bi-car-front-fill" aria-hidden />
        Mobil
      </Link>
      <Link
        href={buildBehandlerListingHref(qStationary, 1)}
        className={`dir-filter-chip${activeStationary ? ' dir-filter-chip--active' : ''}`}
      >
        <i className="bi bi-building-fill" aria-hidden />
        Praxis
      </Link>
      <Link
        href={buildBehandlerListingHref(qBoth, 1)}
        className={`dir-filter-chip${activeBoth ? ' dir-filter-chip--active' : ''}`}
      >
        <i className="bi bi-building-fill" aria-hidden />
        Praxis &amp; mobil
      </Link>
      <span className="dir-filter-chip dir-filter-chip--soon" title="Folgt">
        <i className="bi bi-clock-fill" aria-hidden />
        Sofort verfügbar
      </span>
      <span className="dir-results-count">
        {totalCount} {totalCount === 1 ? 'Behandler gefunden' : 'Behandler gefunden'}
      </span>
    </div>
  )
}
