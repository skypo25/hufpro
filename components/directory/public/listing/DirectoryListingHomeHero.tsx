export function DirectoryListingHomeHero({ heroImageSrc }: { heroImageSrc: string | null }) {
  return (
    <div className="hero" data-directory-section="hero">
      <div className="hero-left">
        <div className="hero-tag">
          <i className="bi bi-heart-pulse-fill" aria-hidden />
          Verzeichnis für Tierbehandler
        </div>
        <h1 className="hero-title">
          Finde den richtigen
          <br />
          <span>Behandler</span> für dein Tier
        </h1>
        <p className="hero-sub">
          Finde Tierphysiotherapeuten, Osteopathen, Tierheilpraktiker und Hufbearbeiter in deiner Nähe – geprüft und
          bewertet.
        </p>
      </div>
      <div className="hero-right">
        {heroImageSrc ? (
          <img src={heroImageSrc} alt="Illustration: Tiere und Tierbehandler" />
        ) : (
          <div className="hero-right-placeholder" role="img" aria-label="Platzhalter für Hero-Grafik" />
        )}
      </div>
    </div>
  )
}
