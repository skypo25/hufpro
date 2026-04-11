import Link from 'next/link'
import type { BehandlerListingQuery } from '@/lib/directory/public/listingParams'
import { buildBehandlerListingHref } from '@/lib/directory/public/listingParams'

export function DirectoryListingPagination({
  page,
  totalCount,
  totalPages,
  query,
}: {
  page: number
  totalCount: number
  totalPages: number
  query: BehandlerListingQuery
}) {
  if (totalPages <= 1 && totalCount === 0) return null

  const prev = page > 1 ? page - 1 : null
  const next = page < totalPages ? page + 1 : null
  const showNav = totalPages > 1

  return (
    <nav className="dir-pagination" aria-label="Seitenweise Navigation" data-directory-section="pagination">
      <p className="dir-pagination__meta">
        {totalCount === 0 ? (
          '0 Einträge'
        ) : (
          <>
            Seite {page} von {totalPages} · {totalCount} {totalCount === 1 ? 'Eintrag' : 'Einträge'}
          </>
        )}
      </p>
      {showNav ? (
        <div className="dir-pagination__actions">
          {prev != null ? (
            <Link href={buildBehandlerListingHref(query, prev)} className="dir-pagination__btn">
              Zurück
            </Link>
          ) : (
            <span className="dir-pagination__btn dir-pagination__btn--disabled">Zurück</span>
          )}
          {next != null ? (
            <Link href={buildBehandlerListingHref(query, next)} className="dir-pagination__btn">
              Weiter
            </Link>
          ) : (
            <span className="dir-pagination__btn dir-pagination__btn--disabled">Weiter</span>
          )}
        </div>
      ) : null}
    </nav>
  )
}
