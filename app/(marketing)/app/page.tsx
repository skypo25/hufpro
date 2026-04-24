'use client'

import Image from 'next/image'
import Link from 'next/link'

import './app.css'

export default function AppLandingPage() {
  return (
    <main className="app-mkt">
      <header className="app-mkt__nav" aria-label="App Landing Navigation">
        <div className="app-mkt__nav-in">
          <Link href="/behandler" className="app-mkt__brand" aria-label="anidocs Verzeichnis">
            anidocs
          </Link>
          <div className="app-mkt__nav-actions">
            <Link className="app-mkt__nav-link" href="/behandler">
              Verzeichnis
            </Link>
            <Link className="app-mkt__nav-link" href="/login">
              Login
            </Link>
            <Link className="app-mkt__cta" href="/behandler/app-starten">
              App starten
            </Link>
          </div>
        </div>
      </header>

      <section className="app-mkt__hero" aria-label="AniDocs App">
        <div className="app-mkt__hero-in">
          <div className="app-mkt__tag">
            <span className="app-mkt__tag-dot" aria-hidden />
            AniDocs App für Tierbehandler
          </div>

          <h1 className="app-mkt__title">
            Dokumentation, Kunden & Termine.
            <br />
            <span>Alles in einer App.</span>
          </h1>

          <p className="app-mkt__sub">
            Für Praxis & mobil unterwegs. Weniger Zettel, mehr Überblick — und dein <strong>Top‑Profil</strong> im
            Verzeichnis als Upgrade für mehr Sichtbarkeit.
          </p>

          <div className="app-mkt__hero-actions">
            <Link className="app-mkt__cta" href="/behandler/app-starten">
              App starten
            </Link>
            <Link className="app-mkt__cta app-mkt__cta--ghost" href="/behandler">
              Verzeichnis ansehen
            </Link>
          </div>

          <div className="app-mkt__trust" aria-label="Highlights">
            <div className="app-mkt__trust-item">
              <i className="bi bi-shield-check" aria-hidden />
              DSGVO‑fokussiert
            </div>
            <div className="app-mkt__trust-item">
              <i className="bi bi-phone" aria-hidden />
              Mobile & Desktop
            </div>
            <div className="app-mkt__trust-item">
              <i className="bi bi-stars" aria-hidden />
              Top‑Profil optional
            </div>
          </div>
        </div>

        <div className="app-mkt__hero-visual" aria-hidden>
          <div className="app-mkt__mock">
            <div className="app-mkt__mock-top" />
            <div className="app-mkt__mock-body">
              <div className="app-mkt__mock-row" />
              <div className="app-mkt__mock-row" />
              <div className="app-mkt__mock-row app-mkt__mock-row--short" />
              <div className="app-mkt__mock-card" />
              <div className="app-mkt__mock-card app-mkt__mock-card--alt" />
            </div>
          </div>
        </div>
      </section>

      <section className="app-mkt__section" aria-label="Funktionen">
        <div className="app-mkt__section-in">
          <h2 className="app-mkt__h2">Für deinen Alltag gebaut</h2>
          <p className="app-mkt__p">
            Schnelle Workflows, klare Struktur, weniger Kontextwechsel. Alles so, dass es professionell wirkt — für dich
            und für deine Kundschaft.
          </p>

          <div className="app-mkt__grid">
            <div className="app-mkt__card">
              <div className="app-mkt__icon">
                <i className="bi bi-journal-text" aria-hidden />
              </div>
              <h3>Dokumentation</h3>
              <p>Termine, Befunde, Fotos und Verläufe sauber abgelegt — schnell wiedergefunden.</p>
            </div>
            <div className="app-mkt__card">
              <div className="app-mkt__icon">
                <i className="bi bi-calendar-check" aria-hidden />
              </div>
              <h3>Termine</h3>
              <p>Planung, Erinnerungen und Übersicht — für Praxis und unterwegs.</p>
            </div>
            <div className="app-mkt__card">
              <div className="app-mkt__icon">
                <i className="bi bi-people" aria-hidden />
              </div>
              <h3>Kunden</h3>
              <p>Alle Infos an einem Ort — Adressen, Tiere, Rechnungen und Kommunikation.</p>
            </div>
            <div className="app-mkt__card">
              <div className="app-mkt__icon">
                <i className="bi bi-megaphone" aria-hidden />
              </div>
              <h3>Top‑Profil</h3>
              <p>Mehr Sichtbarkeit im Verzeichnis: prominent, fair rotiert und professionell hervorgehoben.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="app-mkt__section app-mkt__section--alt" aria-label="So startest du">
        <div className="app-mkt__section-in">
          <h2 className="app-mkt__h2">In 3 Schritten startklar</h2>
          <div className="app-mkt__steps">
            <div className="app-mkt__step">
              <div className="app-mkt__step-num">1</div>
              <div className="app-mkt__step-body">
                <div className="app-mkt__step-title">Konto anlegen</div>
                <div className="app-mkt__step-text">Registrieren oder einloggen — dauert nur kurz.</div>
              </div>
            </div>
            <div className="app-mkt__step">
              <div className="app-mkt__step-num">2</div>
              <div className="app-mkt__step-body">
                <div className="app-mkt__step-title">App starten</div>
                <div className="app-mkt__step-text">Zugang aktivieren und direkt loslegen.</div>
              </div>
            </div>
            <div className="app-mkt__step">
              <div className="app-mkt__step-num">3</div>
              <div className="app-mkt__step-body">
                <div className="app-mkt__step-title">Profil sichtbar machen</div>
                <div className="app-mkt__step-text">Optional Top‑Profil fürs Verzeichnis aktivieren.</div>
              </div>
            </div>
          </div>

          <div className="app-mkt__center">
            <Link className="app-mkt__cta" href="/behandler/app-starten">
              App starten
            </Link>
            <div className="app-mkt__muted">
              Du willst erstmal nur ins Verzeichnis? <Link href="/behandler">Hier entlang</Link>.
            </div>
          </div>
        </div>
      </section>

      <footer className="app-mkt__footer" aria-label="Footer">
        <div className="app-mkt__footer-in">
          <div className="app-mkt__foot-left">
            <Link href="/behandler" className="app-mkt__brand app-mkt__brand--foot" aria-label="anidocs Verzeichnis">
              <Image src="/logo.svg" alt="anidocs" width={120} height={38} className="app-mkt__logo" />
            </Link>
            <div className="app-mkt__muted">Die App für Tierbehandler — organisiert, sichtbar, professionell.</div>
          </div>
          <div className="app-mkt__foot-links">
            <Link href="/datenschutz">Datenschutz</Link>
            <Link href="/agb">AGB</Link>
            <Link href="/behandler">Verzeichnis</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}

