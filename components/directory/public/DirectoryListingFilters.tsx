import Link from 'next/link'
import type { DirectoryPublicAnimalTypeRow, DirectoryPublicSpecialtyRow } from '@/lib/directory/public/types'
import type { BehandlerListingQuery } from '@/lib/directory/public/listingParams'
import { RADIUS_KM_OPTIONS } from '@/lib/directory/public/listingParams'

/**
 * GET-Formular für Filter — keine Client-Logik.
 * `data-directory-section="filters"` für späteres HTML-Layout.
 */
export function DirectoryListingFilters({
  specialties,
  animalTypes,
  values,
}: {
  specialties: DirectoryPublicSpecialtyRow[]
  animalTypes: DirectoryPublicAnimalTypeRow[]
  values: BehandlerListingQuery
}) {
  return (
    <section data-directory-section="filters" className="mb-8">
      <form
        method="get"
        action="/behandler"
        className="rounded-[var(--radius-app)] border border-border bg-card p-4 shadow-[var(--shadow)] sm:p-5"
      >
        <fieldset className="min-w-0 border-0 p-0">
          <legend className="mb-3 text-sm font-semibold text-foreground">Suche &amp; Filter</legend>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <div className="flex min-w-0 flex-col gap-1 text-sm">
              <label htmlFor="dir-filter-location" className="text-[var(--text-secondary)]">
                Ort oder PLZ
              </label>
              <input
                id="dir-filter-location"
                name="location"
                type="search"
                autoComplete="address-level2"
                defaultValue={values.location}
                placeholder="z. B. Berlin oder 10115"
                className="min-h-11 rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1 text-sm">
              <label htmlFor="dir-filter-radius" className="text-[var(--text-secondary)]">
                Umkreis
              </label>
              <select
                id="dir-filter-radius"
                name="radiusKm"
                defaultValue={String(values.radiusKm)}
                className="min-h-11 rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-[var(--accent)]"
              >
                {RADIUS_KM_OPTIONS.map((km) => (
                  <option key={km} value={km}>
                    {km} km
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-0 flex-col gap-1 text-sm">
              <label htmlFor="dir-filter-specialty" className="text-[var(--text-secondary)]">
                Fachrichtung
              </label>
              <select
                id="dir-filter-specialty"
                name="specialtyId"
                defaultValue={values.specialtyId}
                className="min-h-11 rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-[var(--accent)]"
              >
                <option value="">Alle Fachrichtungen</option>
                {specialties.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-0 flex-col gap-1 text-sm">
              <label htmlFor="dir-filter-animal" className="text-[var(--text-secondary)]">
                Tierart
              </label>
              <select
                id="dir-filter-animal"
                name="animalTypeId"
                defaultValue={values.animalTypeId}
                className="min-h-11 rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-[var(--accent)]"
              >
                <option value="">Alle Tierarten</option>
                {animalTypes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-0 flex-col gap-1 text-sm">
              <label htmlFor="dir-filter-service" className="text-[var(--text-secondary)]">
                Angebotsform
              </label>
              <select
                id="dir-filter-service"
                name="serviceType"
                defaultValue={values.serviceType}
                className="min-h-11 rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-[var(--accent)]"
              >
                <option value="">Alle (Praxis &amp; mobil)</option>
                <option value="stationary">Nur Praxis / fest</option>
                <option value="mobile">Nur mobil</option>
                <option value="both">Praxis &amp; mobil</option>
              </select>
            </div>
          </div>
        </fieldset>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="submit"
            className="min-h-11 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-95"
          >
            Ergebnisse anzeigen
          </button>
          <Link
            href="/behandler"
            className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-[var(--accent-light)]"
          >
            Alle Filter zurücksetzen
          </Link>
        </div>
      </form>
    </section>
  )
}
