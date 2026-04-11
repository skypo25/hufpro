/** Einleitung Listing — Layout später per HTML ersetzbar (`data-directory-section`). */
export function DirectoryListingIntro() {
  return (
    <header className="mb-8" data-directory-section="intro">
      <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Tierbehandler-Verzeichnis
      </h1>
      <p className="mt-3 max-w-2xl text-pretty text-[var(--text-secondary)]">
        Finde veröffentlichte Tiergesundheitsberufe nach Ort, Fachrichtung, Tierart und Angebotsform. Die AniDocs App
        für deine Praxis erreichst du über die Kopfzeile.
      </p>
    </header>
  )
}
