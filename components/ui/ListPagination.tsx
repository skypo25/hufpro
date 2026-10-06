import Link from 'next/link'

type ListPaginationProps = {
  totalRows: number
  currentPage: number
  totalPages: number
  perPage: number
  startIndex: number
  endIndex: number
  itemLabel: string
  buildHref: (page: number, perPage: number) => string
  /** Hidden fields for the "pro Seite" form (name → value). */
  perPageFormFields?: Record<string, string>
}

/** Kompakte Seitennavigation: Vor/Zurück + bis zu 7 Seitenzahlen. */
export default function ListPagination({
  totalRows,
  currentPage,
  totalPages,
  perPage,
  startIndex,
  endIndex,
  itemLabel,
  buildHref,
  perPageFormFields = {},
}: ListPaginationProps) {
  if (totalRows <= 0) return null

  const pages = visiblePages(currentPage, totalPages)

  return (
    <div className="flex flex-col gap-3 border-t border-[#E5E2DC] px-[22px] py-4 md:flex-row md:items-center md:justify-between">
      <div className="text-[14px] text-[#6B7280]">
        {totalRows <= perPage
          ? `${totalRows} ${itemLabel}`
          : `Zeige ${startIndex + 1}–${Math.min(endIndex, totalRows)} von ${totalRows} ${itemLabel}`}
      </div>

      {totalRows > 10 ? (
        <div className="flex flex-wrap items-center gap-3">
          <form method="get" className="flex items-center gap-2">
            {Object.entries(perPageFormFields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <label className="text-[14px] text-[#6B7280]">pro Seite</label>
            <select
              name="perPage"
              defaultValue={String(perPage)}
              className="rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[14px] text-[#1B1F23] outline-none"
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
            <button
              type="submit"
              className="rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[14px] font-medium text-[#1B1F23]"
            >
              OK
            </button>
          </form>

          {totalPages > 1 ? (
            <div className="flex items-center gap-1">
              <Link
                href={buildHref(Math.max(1, currentPage - 1), perPage)}
                className={[
                  'inline-flex h-9 w-9 items-center justify-center rounded-lg border text-[14px]',
                  currentPage === 1
                    ? 'pointer-events-none border-[#E5E2DC] bg-white text-[#9CA3AF] opacity-50'
                    : 'border-[#E5E2DC] bg-white text-[#1B1F23] hover:border-primary hover:text-primary',
                ].join(' ')}
                aria-label="Vorherige Seite"
              >
                <i className="bi bi-chevron-left" />
              </Link>

              {pages.map((p, idx) =>
                p === '…' ? (
                  <span key={`e-${idx}`} className="px-1 text-[14px] text-[#9CA3AF]">
                    …
                  </span>
                ) : (
                  <Link
                    key={p}
                    href={buildHref(p, perPage)}
                    className={[
                      'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-[14px] font-medium',
                      p === currentPage
                        ? 'border-primary bg-primary text-white'
                        : 'border-[#E5E2DC] bg-white text-[#1B1F23] hover:border-primary hover:text-primary',
                    ].join(' ')}
                  >
                    {p}
                  </Link>
                )
              )}

              <Link
                href={buildHref(Math.min(totalPages, currentPage + 1), perPage)}
                className={[
                  'inline-flex h-9 w-9 items-center justify-center rounded-lg border text-[14px]',
                  currentPage === totalPages
                    ? 'pointer-events-none border-[#E5E2DC] bg-white text-[#9CA3AF] opacity-50'
                    : 'border-[#E5E2DC] bg-white text-[#1B1F23] hover:border-primary hover:text-primary',
                ].join(' ')}
                aria-label="Nächste Seite"
              >
                <i className="bi bi-chevron-right" />
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function visiblePages(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set<number>()
  pages.add(1)
  pages.add(total)
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= total) pages.add(p)
  }
  const sorted = [...pages].sort((a, b) => a - b)
  const out: Array<number | '…'> = []
  let prev = 0
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('…')
    out.push(p)
    prev = p
  }
  return out
}

export function parseListPageParams(raw: { page?: string; perPage?: string }) {
  const perPageRaw = Number(raw.perPage || '10')
  const perPage = [10, 20, 50].includes(perPageRaw) ? perPageRaw : 10
  const pageRaw = Number(raw.page || '1')
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1
  return { page, perPage }
}
