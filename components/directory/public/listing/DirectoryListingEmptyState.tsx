export function DirectoryListingEmptyState({
  hasActiveFilters,
  radiusSearch,
}: {
  /** true, wenn mindestens ein Filter gesetzt ist (leere Trefferliste). */
  hasActiveFilters: boolean
  /** true, wenn Umkreissuche aktiv war (Hinweis Radius vergrößern). */
  radiusSearch?: boolean
}) {
  return (
    <div
      role="status"
      data-directory-section="empty"
      className="rounded-[var(--radius-app)] border border-dashed border-border bg-card/50 px-4 py-12 text-center"
    >
      {hasActiveFilters ? (
        <>
          <p className="font-medium text-foreground">Keine Treffer für diese Filter</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {radiusSearch
              ? 'Versuche einen größeren Umkreis oder eine andere Ortsangabe. Profile ohne Koordinaten erscheinen in der Umkreissuche nicht.'
              : 'Bitte Filter lockern oder zurücksetzen. Es werden nur veröffentlichte Profile angezeigt.'}
          </p>
        </>
      ) : (
        <>
          <p className="font-medium text-foreground">Noch keine veröffentlichten Einträge</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Sobald Profile im Verzeichnis freigeschaltet sind, erscheinen sie hier.
          </p>
        </>
      )}
    </div>
  )
}
