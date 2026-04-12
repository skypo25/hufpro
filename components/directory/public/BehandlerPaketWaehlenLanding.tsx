'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { directoryAppBaseUrl, directoryProfileRegisterHref } from '@/lib/directory/public/appBaseUrl'

const HREF_GRATIS = directoryProfileRegisterHref({ paket: 'gratis' })
const HREF_PREMIUM = directoryProfileRegisterHref({ paket: 'premium' })
const HREF_APP = '/behandler/app-starten'

export function BehandlerPaketWaehlenLanding() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [faqOpen, setFaqOpen] = useState<number | null>(null)
  const [mobOpen, setMobOpen] = useState<'gratis' | 'premium' | 'system' | null>('premium')
  const faqHeadingId = useId()

  const toggleFaq = useCallback((i: number) => {
    setFaqOpen((prev) => (prev === i ? null : i))
  }, [])

  const toggleMob = useCallback((k: 'gratis' | 'premium' | 'system') => {
    setMobOpen((prev) => (prev === k ? null : k))
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const els = root.querySelectorAll<HTMLElement>('.rv')
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('vis')
            obs.unobserve(e.target)
          }
        })
      },
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' },
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  const appBase = directoryAppBaseUrl()
  const hilfeUrl = `${appBase}/hilfe`

  return (
    <div id="dir-pw-root" ref={rootRef} className="dir-pw-page">
      <div className="hero rv">
        <div className="hero-pill">
          <i className="bi bi-rocket-takeoff-fill" aria-hidden />
          Profil erstellen
        </div>
        <h1>
          So startest du bei <span>anidocs</span>
        </h1>
        <div className="hero-sub">
          Wähle das Paket, das zu dir passt. Starte kostenlos und erweitere jederzeit, wenn du mehr möchtest.
        </div>
      </div>

      <div id="dir-pw-cards" className="cards rv">
        <div className="card">
          <div className="c-icon i-free">
            <i className="bi bi-person-fill" aria-hidden />
          </div>
          <h3 className="c-name">Gratis</h3>
          <div className="c-tagline">Sichtbar werden</div>
          <div className="c-desc">Dein Profil im anidocs-Verzeichnis — damit Tierhalter dich finden können.</div>
          <div className="c-price">
            <span className="c-amount green">0 €</span>
          </div>
          <div className="c-feats">
            <div className="cf">
              <span className="cf-ic yes">
                <i className="bi bi-check" aria-hidden />
              </span>
              Eigenes Profil im Verzeichnis
            </div>
            <div className="cf">
              <span className="cf-ic yes">
                <i className="bi bi-check" aria-hidden />
              </span>
              Fachrichtungen &amp; Spezialisierungen angeben
            </div>
            <div className="cf">
              <span className="cf-ic yes">
                <i className="bi bi-check" aria-hidden />
              </span>
              Leistungen &amp; Methoden darstellen
            </div>
            <div className="cf">
              <span className="cf-ic yes">
                <i className="bi bi-check" aria-hidden />
              </span>
              Standort &amp; Einsatzgebiet anzeigen
            </div>
            <div className="cf off">
              <span className="cf-ic no">
                <i className="bi bi-x" aria-hidden />
              </span>
              Bildergalerie
            </div>
            <div className="cf off">
              <span className="cf-ic no">
                <i className="bi bi-x" aria-hidden />
              </span>
              Kontaktformular
            </div>
          </div>
          <Link href={HREF_GRATIS} className="c-cta ghost">
            Kostenlos starten
            <i className="bi bi-arrow-right" aria-hidden />
          </Link>
        </div>

        <div className="card prem">
          <span className="prem-badge">
            <i className="bi bi-star-fill" style={{ fontSize: 10 }} aria-hidden /> Empfohlen
          </span>
          <div className="c-icon i-prem">
            <i className="bi bi-gem" aria-hidden />
          </div>
          <h3 className="c-name">Premium</h3>
          <div className="c-tagline">Besser sichtbar werden</div>
          <div className="c-desc">
            Zeig dich von deiner besten Seite — mit Bildern, Kontaktformular und hochwertigem Profil.
          </div>
          <div className="c-price">
            <span className="c-amount">9,95 €</span>
            <span className="c-per">/ Monat</span>
          </div>
          <div className="c-feats">
            <div className="cf">
              <span className="cf-ic yes">
                <i className="bi bi-check" aria-hidden />
              </span>
              Alles aus Gratis
            </div>
            <div className="cf">
              <span className="cf-ic yes">
                <i className="bi bi-check" aria-hidden />
              </span>
              Bildergalerie auf deinem Profil
            </div>
            <div className="cf">
              <span className="cf-ic yes">
                <i className="bi bi-check" aria-hidden />
              </span>
              Kontaktformular — Anfragen direkt erhalten
            </div>
            <div className="cf">
              <span className="cf-ic yes">
                <i className="bi bi-check" aria-hidden />
              </span>
              Hochwertigere Profildarstellung
            </div>
            <div className="cf">
              <span className="cf-ic yes">
                <i className="bi bi-check" aria-hidden />
              </span>
              Bevorzugte Sichtbarkeit im Verzeichnis
            </div>
          </div>
          <Link href={HREF_PREMIUM} className="c-cta green">
            Premium wählen
            <i className="bi bi-arrow-right" aria-hidden />
          </Link>
        </div>

        <div className="card feat">
          <span className="feat-badge">
            <i className="bi bi-lightning-charge-fill" style={{ fontSize: 10 }} aria-hidden /> Umfangreichstes Paket
          </span>
          <div className="c-icon i-sys">
            <i className="bi bi-grid-fill" aria-hidden />
          </div>
          <h3 className="c-name">Behandler-System</h3>
          <div className="c-tagline">Professionell arbeiten</div>
          <div className="c-desc">Deine komplette digitale Lösung — vom Verzeichnisprofil bis zur Kundenverwaltung.</div>
          <div className="c-price">
            <span className="c-amount">39,95 €</span>
            <span className="c-per">/ Monat</span>
          </div>
          <div className="c-incl">
            <i className="bi bi-gem" aria-hidden />
            Premium-Verzeichnisprofil inklusive
          </div>
          <div className="c-feats">
            <div className="cf">
              <span className="cf-ic yes">
                <i className="bi bi-check" aria-hidden />
              </span>
              Alles aus Premium
            </div>
            <div className="cf">
              <span className="cf-ic yes">
                <i className="bi bi-check" aria-hidden />
              </span>
              Termine planen &amp; organisieren
            </div>
            <div className="cf">
              <span className="cf-ic yes">
                <i className="bi bi-check" aria-hidden />
              </span>
              Behandlungen dokumentieren
            </div>
            <div className="cf">
              <span className="cf-ic yes">
                <i className="bi bi-check" aria-hidden />
              </span>
              Kunden &amp; Tiere verwalten
            </div>
            <div className="cf">
              <span className="cf-ic yes">
                <i className="bi bi-check" aria-hidden />
              </span>
              Rechnungen erstellen
            </div>
          </div>
          <Link href={HREF_APP} className="c-cta dark">
            Behandler-System starten
            <i className="bi bi-arrow-right" aria-hidden />
          </Link>
        </div>
      </div>

      <div className="comp-sec">
        <div className="comp-head rv">
          <div className="sec-label">
            <i className="bi bi-layout-text-window-reverse" aria-hidden />
            Vergleich
          </div>
          <h2>Alle Funktionen im Überblick</h2>
          <p style={{ fontSize: 14, color: 'var(--l)' }}>Was ist in welchem Paket enthalten?</p>
        </div>

        <div className="comp rv">
          <div className="cr head">
            <div className="cc left" />
            <div className="ch">
              <div className="ch-name">Gratis</div>
              <div className="ch-price">0 €</div>
            </div>
            <div className="ch hl">
              <div className="ch-name" style={{ color: 'var(--accent)' }}>
                Premium
              </div>
              <div className="ch-price">9,95 € / Monat</div>
            </div>
            <div className="ch">
              <div className="ch-name">Behandler-System</div>
              <div className="ch-price">39,95 € / Monat</div>
            </div>
          </div>

          <div className="cr grp">
            <div className="cc left grp-label" style={{ gridColumn: '1 / -1' }}>
              Verzeichnisprofil
            </div>
          </div>
          <CompRow left="Eigenes Profil im Verzeichnis" cells={['y', 'y', 'y']} />
          <CompRow left="Fachrichtungen & Spezialisierungen" cells={['y', 'y', 'y']} />
          <CompRow left="Leistungen & Methoden" cells={['y', 'y', 'y']} />
          <CompRow left="Standort & Einsatzgebiet" cells={['y', 'y', 'y']} />
          <CompRow left="Bildergalerie" cells={['n', 'y', 'y']} />
          <CompRow left="Kontaktformular" cells={['n', 'y', 'y']} />
          <CompRow left="Hochwertigere Profildarstellung" cells={['n', 'y', 'y']} />
          <CompRow left="Bevorzugte Sichtbarkeit" cells={['n', 'y', 'y']} />

          <div className="cr grp">
            <div className="cc left grp-label" style={{ gridColumn: '1 / -1' }}>
              Behandler-System
            </div>
          </div>
          <CompRow left="Terminverwaltung" cells={['n', 'n', 'y']} />
          <CompRow left="Behandlungsdokumentation" cells={['n', 'n', 'y']} />
          <CompRow left="Kunden- & Tierverwaltung" cells={['n', 'n', 'y']} />
          <CompRow left="Rechnungen erstellen" cells={['n', 'n', 'y']} />
        </div>

        <div className="mob-comp rv">
          <MobPanel
            title="Gratis · 0 €"
            variant="default"
            open={mobOpen === 'gratis'}
            onToggle={() => toggleMob('gratis')}
          >
            <MobRow label="Eigenes Profil" yes />
            <MobRow label="Fachrichtungen & Spezialisierungen" yes />
            <MobRow label="Leistungen & Methoden" yes />
            <MobRow label="Standort & Einsatzgebiet" yes />
            <MobRow label="Bildergalerie" no muted />
            <MobRow label="Kontaktformular" no muted />
            <MobRow label="Behandler-System" no muted />
          </MobPanel>
          <MobPanel
            title="Premium · 9,95 € / Monat"
            variant="hl"
            open={mobOpen === 'premium'}
            onToggle={() => toggleMob('premium')}
          >
            <MobRow label="Alles aus Gratis" yes />
            <MobRow label="Bildergalerie" yes />
            <MobRow label="Kontaktformular" yes />
            <MobRow label="Hochwertigere Darstellung" yes />
            <MobRow label="Bevorzugte Sichtbarkeit" yes />
            <MobRow label="Behandler-System" no muted />
          </MobPanel>
          <MobPanel
            title="Behandler-System · 39,95 €"
            variant="dk"
            open={mobOpen === 'system'}
            onToggle={() => toggleMob('system')}
          >
            <MobRow label="Alles aus Premium" yes />
            <MobRow label="Terminverwaltung" yes />
            <MobRow label="Behandlungsdokumentation" yes />
            <MobRow label="Kunden- & Tierverwaltung" yes />
            <MobRow label="Rechnungen erstellen" yes />
          </MobPanel>
        </div>
      </div>

      <div className="hints rv">
        <div className="hints-grid">
          <div className="hint">
            <div className="hint-ic">
              <i className="bi bi-arrow-up-circle-fill" aria-hidden />
            </div>
            <div>
              <div className="hint-t">Jederzeit erweitern</div>
              <div className="hint-d">
                Starte kostenlos und wechsle auf Premium oder das Behandler-System, wann immer du möchtest.
              </div>
            </div>
          </div>
          <div className="hint">
            <div className="hint-ic">
              <i className="bi bi-gem" aria-hidden />
            </div>
            <div>
              <div className="hint-t">Premium inklusive</div>
              <div className="hint-d">
                Im Behandler-System ist das Premium-Verzeichnisprofil automatisch enthalten — du brauchst es nicht
                extra zu buchen.
              </div>
            </div>
          </div>
          <div className="hint">
            <div className="hint-ic">
              <i className="bi bi-clock-fill" aria-hidden />
            </div>
            <div>
              <div className="hint-t">In Minuten startklar</div>
              <div className="hint-d">
                Profil anlegen, Fachrichtungen wählen, Leistungen eintragen — und schon bist du im Verzeichnis sichtbar.
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="faq-sec rv" aria-labelledby={faqHeadingId}>
        <div className="comp-head">
          <div className="sec-label">
            <i className="bi bi-chat-dots-fill" aria-hidden />
            Fragen
          </div>
          <h2 id={faqHeadingId}>Häufige Fragen</h2>
        </div>
        {FAQ_ITEMS.map((item, i) => (
          <div key={item.q} className={`faq${faqOpen === i ? ' open' : ''}`}>
            <button type="button" className="faq-q" onClick={() => toggleFaq(i)} aria-expanded={faqOpen === i}>
              {item.q}
              <i className="bi bi-plus-lg" aria-hidden />
            </button>
            <div className="faq-a">
              <div className="faq-a-in">{item.a}</div>
            </div>
          </div>
        ))}
      </section>

      <div className="bot">
        <h2>Finde den passenden Einstieg</h2>
        <p>
          Ob kostenlos sichtbar werden, Premium-Profil oder das volle Behandler-System — starte jetzt und erweitere
          jederzeit.
        </p>
        <div className="bot-row">
          <a href="#dir-pw-cards" className="btn btn-p">
            <i className="bi bi-rocket-takeoff-fill" aria-hidden />
            Jetzt Profil erstellen
          </a>
          <a href={hilfeUrl} className="btn btn-s" target="_blank" rel="noopener noreferrer">
            <i className="bi bi-chat-dots-fill" aria-hidden />
            Fragen? Schreib uns
          </a>
        </div>
      </div>
    </div>
  )
}

function CompRow({ left, cells }: { left: string; cells: readonly ('y' | 'n')[] }) {
  return (
    <div className="cr">
      <div className="cc left">{left}</div>
      {cells.map((cell, i) => (
        <div key={i} className={`cc${i === 1 ? ' hl' : ''}`}>
          {cell === 'y' ? (
            <span className="ck y">
              <i className="bi bi-check" aria-hidden />
            </span>
          ) : (
            <span className="ck n" aria-label="Nicht enthalten">
              –
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function MobPanel({
  title,
  variant,
  open,
  onToggle,
  children,
}: {
  title: string
  variant: 'default' | 'hl' | 'dk'
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  const headClass =
    variant === 'hl' ? 'mp-head hl' : variant === 'dk' ? 'mp-head dk' : 'mp-head'
  return (
    <div className={`mp${open ? ' open' : ''}`}>
      <button type="button" className={headClass} onClick={onToggle} aria-expanded={open}>
        {title}
        <i className="bi bi-chevron-down" aria-hidden style={variant === 'dk' ? { color: 'rgba(255,255,255,.4)' } : undefined} />
      </button>
      <div className="mp-body">
        <div>{children}</div>
      </div>
    </div>
  )
}

function MobRow({ label, yes, muted }: { label: string; yes?: boolean; no?: boolean; muted?: boolean }) {
  return (
    <div className="mr" style={muted ? { opacity: 0.3 } : undefined}>
      {label}
      {yes ? (
        <span className="ck y" style={{ width: 18, height: 18, fontSize: 9 }}>
          <i className="bi bi-check" aria-hidden />
        </span>
      ) : (
        <span className="ck n" style={{ width: 18, height: 18, fontSize: 12 }}>
          –
        </span>
      )}
    </div>
  )
}

const FAQ_ITEMS = [
  {
    q: 'Was genau ist das Behandler-System?',
    a: 'Das Behandler-System ist die vollständige anidocs-Lösung für deinen Arbeitsalltag. Du kannst damit Termine organisieren, Behandlungen dokumentieren, Kunden und Tiere verwalten und Rechnungen erstellen — alles an einem Ort. Dein Premium-Verzeichnisprofil ist automatisch dabei.',
  },
  {
    q: 'Kann ich später auf ein anderes Paket wechseln?',
    a: 'Ja. Du kannst jederzeit von Gratis auf Premium oder auf das Behandler-System wechseln. Dein Profil und alle eingetragenen Daten bleiben vollständig erhalten.',
  },
  {
    q: 'Was passiert mit meinem Profil, wenn ich kündige?',
    a: 'Dein Profil bleibt als Gratis-Eintrag im Verzeichnis bestehen. Premium-Funktionen wie die Bildergalerie und das Kontaktformular werden deaktiviert, aber deine Grunddaten gehen nicht verloren.',
  },
  {
    q: 'Brauche ich als mobiler Behandler auch das Behandler-System?',
    a: 'Gerade als mobiler Behandler kann das System besonders hilfreich sein: Termine unterwegs planen, Behandlungen direkt vor Ort dokumentieren und alles zentral verwalten — auch ohne eigene Praxis.',
  },
  {
    q: 'Gibt es eine Vertragsbindung?',
    a: 'Nein. Alle kostenpflichtigen Pakete sind monatlich kündbar. Es gibt keine langfristige Vertragsbindung.',
  },
] as const
