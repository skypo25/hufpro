import Link from 'next/link'
import type {
  DirectoryPublicAnimalTypeRow,
  DirectoryPublicMethodRow,
  DirectoryPublicProfileMediaRow,
  DirectoryPublicProfileRow,
  DirectoryPublicProfileSocialRow,
  DirectoryPublicSpecialtyRow,
  DirectoryPublicSubcategoryRow,
} from '@/lib/directory/public/types'
import { directoryAboutUrl, directoryPublicProfileAbsoluteUrl } from '@/lib/directory/public/appBaseUrl'
import {
  directoryWeekdayKeyEuropeBerlin,
  formatOpeningHoursForDisplay,
  hasPublicOpeningHoursDisplay,
  normalizeOpeningHoursJson,
} from '@/lib/directory/openingHours'
import {
  countryDachLabel,
  directorySpecialtyDisplayName,
  serviceTypeLabel,
  socialPlatformIconClass,
  socialPlatformLabel,
} from '@/lib/directory/public/labels'
import {
  formatPublicPhoneForDisplay,
  formatPublicPhoneTelHref,
} from '@/lib/directory/public/formatPublicPhone'
import {
  publicProfileSidebarCardTagline,
  publicProfileSidebarCardTitle,
  publicProfileStreetLine,
} from '@/lib/directory/public/profileDisplay'
import {
  descriptionTextForPublicAbout,
  parseCustomMethodsFromDescription,
  parseCustomSpecsFromDescription,
  parseQualiItemsFromDescription,
} from '@/lib/directory/onboarding/parseWizardDescriptionBlocks'
import { coercePgBool } from '@/lib/directory/public/coercePgBool'
import { DirectoryProfileViewBeacon } from '@/components/directory/public/DirectoryProfileViewBeacon'

import { DirectoryProfileContactForm } from './DirectoryProfileContactForm'
import { DirectoryProfileGalleryGrid } from './DirectoryProfileGalleryGrid'
import { DirectoryProfileMapEmbed } from './DirectoryProfileMapEmbed'
import { ProfileBentoPawIcon } from './ProfileBentoPawIcon'
import { ProfileBentoSpecialtyIcon } from './ProfileBentoSpecialtyIcon'
import { DirectoryProfileSectionTabs } from './DirectoryProfileSectionTabs'
import { DirectoryProfileShareButton } from './DirectoryProfileShareButton'
import { DirectoryProfileTrackedPhoneLink } from './DirectoryProfileTrackedPhoneLink'
import { DirectoryProfileMobBarCtaReveal } from './DirectoryProfileMobBarCtaReveal'
import { DirectoryProfileMobBarShell } from './DirectoryProfileMobBarShell'
import { DirectoryProfileSidebarHoursDisclosure } from './DirectoryProfileSidebarHoursDisclosure'
import { ProfileHeroBlock } from './ProfileHeroBlock'

export function DirectoryProfilePublicDetail({
  profile,
  specialties,
  animalTypes,
  subcategories,
  methods,
  media,
  social,
}: {
  profile: DirectoryPublicProfileRow
  specialties: DirectoryPublicSpecialtyRow[]
  animalTypes: DirectoryPublicAnimalTypeRow[]
  subcategories: DirectoryPublicSubcategoryRow[]
  methods: DirectoryPublicMethodRow[]
  media: DirectoryPublicProfileMediaRow[]
  social: DirectoryPublicProfileSocialRow[]
}) {
  const aboutHref = directoryAboutUrl()
  const claimHref = `/behandler/${profile.slug}/claim`
  const shareUrl = directoryPublicProfileAbsoluteUrl(profile.slug)
  const socialSorted = [...social].sort((a, b) => a.sort_order - b.sort_order)
  /** Nur Galerie-Fotos, kein Logo (Logo bleibt im Hero). */
  const galleryWithUrl = media
    .filter((m) => m.media_type === 'photo' && m.url && m.url.trim() !== '')
    .sort((a, b) => a.sort_order - b.sort_order)
  const topActive = coercePgBool(profile.top_active)
  const premiumContact = coercePgBool(profile.premium_contact_enabled)
  /** Kontakt-Hinweis: Vor- und Nachname aus Profil, sonst Anzeigename. */
  const kontaktDirectName =
    [profile.first_name?.trim(), profile.last_name?.trim()].filter(Boolean).join(' ').trim() ||
    profile.display_name.trim()
  const showPremiumGallery = topActive && galleryWithUrl.length > 0
  const logoUrl = media.find((m) => m.media_type === 'logo' && m.url?.trim())?.url?.trim()
  const heroPhotoUrl = topActive ? galleryWithUrl[0]?.url?.trim() : null
  const heroImageUrl = logoUrl || heroPhotoUrl || null
  const sidebarCardTitle = publicProfileSidebarCardTitle(profile)
  const sidebarCardTagline = publicProfileSidebarCardTagline(
    profile,
    specialties.map((s) => directorySpecialtyDisplayName(s.code, s.name))
  )

  const hasShort = Boolean(profile.short_description?.trim())
  const aboutLongText = descriptionTextForPublicAbout(profile.description)
  const hasLongDisplay = Boolean(aboutLongText?.trim())
  /** Ohne Social (siehe Sidebar/Kontakt); langer Text ohne Chip-Blöcke „Eigene …“. */
  const hasAboutSection = hasShort || hasLongDisplay

  const customSpecsPublic = parseCustomSpecsFromDescription(profile.description)
  const customMethodsPublic = parseCustomMethodsFromDescription(profile.description)
  const qualiItemsPublic = parseQualiItemsFromDescription(profile.description)
  const showMethodsSection = methods.length > 0 || customMethodsPublic.length > 0
  const showSpecSection = subcategories.length > 0 || customSpecsPublic.length > 0
  const showQualiSection = qualiItemsPublic.length > 0

  const hasArea = Boolean(profile.service_area_text?.trim())
  const hasRadius = profile.service_radius_km != null && String(profile.service_radius_km).trim() !== ''
  const phonePublicRaw = (profile.phone_public ?? '').trim()
  const phonePublicDisplay =
    phonePublicRaw.length > 0 ? formatPublicPhoneForDisplay(phonePublicRaw, profile.country) : ''
  const phoneTelHref =
    phonePublicRaw.length > 0 ? formatPublicPhoneTelHref(phonePublicRaw, profile.country) : null
  const plzOrt = [profile.postal_code, profile.city].filter(Boolean).join(' ').trim()
  const streetLine = publicProfileStreetLine(profile)
  const locLine = [streetLine, plzOrt].filter(Boolean).join(' · ') || plzOrt
  const tabs: { id: string; label: string }[] = []
  tabs.push({ id: 'dir-facts', label: 'Auf einen Blick' })
  if (hasAboutSection) tabs.push({ id: 'dir-about', label: 'Über' })
  if (showQualiSection) tabs.push({ id: 'dir-quali', label: 'Qualifikationen' })
  if (showMethodsSection) tabs.push({ id: 'dir-methods', label: 'Leistungen' })
  if (showPremiumGallery) tabs.push({ id: 'dir-gallery', label: 'Galerie' })
  tabs.push({ id: 'dir-area', label: 'Einsatzgebiet' })
  tabs.push({ id: 'profil-kontakt', label: 'Kontakt' })

  const mapLabelParts = [profile.city, hasRadius ? `${profile.service_radius_km} km Umkreis` : null].filter(
    Boolean
  ) as string[]

  const mapCoords =
    profile.latitude != null &&
    profile.longitude != null &&
    Number.isFinite(Number(profile.latitude)) &&
    Number.isFinite(Number(profile.longitude))
      ? { lat: Number(profile.latitude), lng: Number(profile.longitude) }
      : null

  const mapRadiusKm =
    hasRadius && profile.service_radius_km != null
      ? (() => {
          const n = Number(profile.service_radius_km)
          return Number.isFinite(n) && n > 0 ? n : null
        })()
      : null

  const openingHoursJson = normalizeOpeningHoursJson(profile.opening_hours)
  const openingHoursNote = (profile.opening_hours_note ?? '').trim()
  const showOpeningBlock = hasPublicOpeningHoursDisplay(openingHoursJson, openingHoursNote)
  const openingLines = formatOpeningHoursForDisplay(openingHoursJson)
  const openingHoursTodayKey = directoryWeekdayKeyEuropeBerlin()

  const addressLines = [
    streetLine,
    plzOrt || null,
    [profile.state, countryDachLabel(profile.country)].filter(Boolean).join(', ') || null,
  ].filter(Boolean) as string[]

  return (
    <div className="dir-prof-page dir-prof-v2" data-directory-profile>
      <DirectoryProfileViewBeacon profileId={profile.id} slug={profile.slug} />
      <div className="dir-prof-v2-hero-wrap">
        <ProfileHeroBlock
          profile={profile}
          specialties={specialties}
          animalTypes={animalTypes}
          heroImageUrl={heroImageUrl}
        />
      </div>

      <div className="dir-prof-v2-quick-cta" id="dir-prof-quick-cta" aria-label="Schnellkontakt">
        <div className="dir-prof-v2-quick-cta-in">
          {phoneTelHref ? (
            <DirectoryProfileTrackedPhoneLink
              slug={profile.slug}
              href={phoneTelHref}
              className="dir-prof-v2-quick-call dir-prof-v2-ha dir-prof-v2-ha--dark"
            >
              <i className="bi bi-telephone-fill" aria-hidden />
              Anrufen
            </DirectoryProfileTrackedPhoneLink>
          ) : null}
          {premiumContact ? (
            <a href="#profil-kontakt" className="dir-prof-v2-quick-call dir-prof-v2-ha dir-prof-v2-ha--p">
              <i className="bi bi-envelope-fill" aria-hidden />
              Nachricht
            </a>
          ) : !phoneTelHref ? (
            <a href="#profil-kontakt" className="dir-prof-v2-quick-call dir-prof-v2-ha dir-prof-v2-ha--s">
              <i className="bi bi-chat-dots-fill" aria-hidden />
              Kontakt
            </a>
          ) : null}
        </div>
      </div>

      <DirectoryProfileSectionTabs tabs={tabs} />

      <div className="dir-prof-v2-profile-layout">
        <div className="dir-prof-v2-facts-main-stack">
          <section className="dir-prof-v2-sec" id="dir-facts">
            <div className="dir-prof-v2-facts-main">
              <div className="dir-prof-v2-facts-head">
              <div className="dir-prof-v2-sec-label">
                <i className="bi bi-grid-fill" aria-hidden />
                Auf einen Blick
              </div>
              <h2 className="dir-prof-v2-sec-h2">Das Wichtigste im Überblick</h2>
            </div>
            <div className="dir-prof-v2-bento">
              {specialties.length === 1 ? (
                <div className="dir-prof-v2-bc dir-prof-v2-bc--tall">
                  <div>
                    <div className="dir-prof-v2-bc-icon">
                      <ProfileBentoSpecialtyIcon code={specialties[0]!.code} />
                    </div>
                    <div className="dir-prof-v2-bc-lab">Fachrichtung</div>
                    <div className="dir-prof-v2-bc-val">
                      {directorySpecialtyDisplayName(specialties[0]!.code, specialties[0]!.name)}
                    </div>
                  </div>
                  {subcategories.length > 0 ? (
                    <div className="dir-prof-v2-bc-chips">
                      {subcategories.slice(0, 8).map((s) => (
                        <span key={s.id} className="dir-prof-v2-bc-chip">
                          {s.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : specialties.length > 1 ? (
                <>
                  <div className="dir-prof-v2-bento-specs">
                    {specialties.map((spec, specIdx) => {
                      const n = specialties.length
                      const spanFull = n >= 3 && n % 2 === 1 && specIdx === n - 1
                      return (
                        <div
                          key={spec.id}
                          className={`dir-prof-v2-bc${spanFull ? ' dir-prof-v2-bc--spec-span-full' : ''}`}
                        >
                          <div className="dir-prof-v2-bc-icon">
                            <ProfileBentoSpecialtyIcon code={spec.code} />
                          </div>
                          <div className="dir-prof-v2-bc-lab">Fachrichtung</div>
                          <div className="dir-prof-v2-bc-val">
                            {directorySpecialtyDisplayName(spec.code, spec.name)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {subcategories.length > 0 ? (
                    <div className="dir-prof-v2-bc dir-prof-v2-bc--wide">
                      <div className="dir-prof-v2-bc-icon">
                        <i className="bi bi-mortarboard-fill" aria-hidden />
                      </div>
                      <div className="dir-prof-v2-bc-lab">Spezialisierungen</div>
                      <div className="dir-prof-v2-bc-chips">
                        {subcategories.slice(0, 8).map((s) => (
                          <span key={s.id} className="dir-prof-v2-bc-chip">
                            {s.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}

              <div className="dir-prof-v2-bento-ani-work">
                {animalTypes.length > 0 ? (
                  <div className="dir-prof-v2-bc">
                    <div className="dir-prof-v2-bc-icon">
                      <ProfileBentoPawIcon />
                    </div>
                    <div className="dir-prof-v2-bc-lab">Tierarten</div>
                    <div className="dir-prof-v2-bc-chips">
                      {animalTypes.map((a) => (
                        <span key={a.id} className="dir-prof-v2-bc-chip">
                          {a.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="dir-prof-v2-bc">
                  <div className="dir-prof-v2-bc-icon">
                    <i className="bi bi-car-front-fill" aria-hidden />
                  </div>
                  <div className="dir-prof-v2-bc-lab">Arbeitsweise</div>
                  <div className="dir-prof-v2-bc-val">{serviceTypeLabel(profile.service_type)}</div>
                </div>
              </div>

              {hasRadius ? (
                <div className="dir-prof-v2-bc">
                  <div className="dir-prof-v2-bc-big">{profile.service_radius_km}</div>
                  <div className="dir-prof-v2-bc-lab">Kilometer Einsatzradius</div>
                </div>
              ) : null}

              {hasArea ? (
                <div className="dir-prof-v2-bc dir-prof-v2-bc--wide">
                  <div className="dir-prof-v2-bc-icon">
                    <i className="bi bi-signpost-fill" aria-hidden />
                  </div>
                  <div className="dir-prof-v2-bc-lab">Unterwegs in</div>
                  <div className="dir-prof-v2-bc-val">{profile.service_area_text}</div>
                </div>
              ) : null}
            </div>
          </div>
          </section>

          {hasAboutSection ? (
            <section className="dir-prof-v2-sec" id="dir-about">
              <div className="dir-prof-v2-sec-label">
                <i className="bi bi-person-fill" aria-hidden />
                Über
              </div>
              <h2 className="dir-prof-v2-sec-h2">Über {profile.display_name}</h2>
              {hasShort ? <p className="dir-prof-v2-sec-sub">{profile.short_description}</p> : null}
              {hasLongDisplay ? (
                <div className={`dir-prof-v2-about${hasShort ? ' dir-prof-v2-about--after-lead' : ''}`}>
                  <div className="whitespace-pre-wrap">{aboutLongText}</div>
                </div>
              ) : null}
            </section>
          ) : null}

          {showQualiSection ? (
            <section className="dir-prof-v2-sec dir-prof-v2-sec--quali-zert" id="dir-quali">
              <div className="dir-prof-v2-quali-card">
                <div className="dir-prof-v2-sec-label">
                  <i className="bi bi-patch-check-fill" aria-hidden />
                  Qualifikationen
                </div>
                <h2 className="dir-prof-v2-sec-h2">Ausbildung &amp; Zertifikate</h2>
                <p className="dir-prof-v2-sec-sub">Nachweise und Qualifikationen im Überblick.</p>
                <div className="dir-prof-v2-spec-grid">
                  {qualiItemsPublic.map((label, idx) => (
                    <div key={`quali-${idx}-${label.slice(0, 24)}`} className="dir-prof-v2-spec">
                      <i className="bi bi-patch-check-fill" aria-hidden />
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {showMethodsSection || showSpecSection ? (
            <div
              className={
                showMethodsSection && showSpecSection
                  ? 'dir-prof-v2-methods-spec-row dir-prof-v2-methods-spec-row--split'
                  : 'dir-prof-v2-methods-spec-row'
              }
            >
              {showMethodsSection ? (
                <section className="dir-prof-v2-sec" id="dir-methods">
                  <div className="dir-prof-v2-sec-label">
                    <i className="bi bi-heart-pulse-fill" aria-hidden />
                    Leistungen
                  </div>
                  <h2 className="dir-prof-v2-sec-h2">Was {profile.display_name} anbietet</h2>
                  <p className="dir-prof-v2-sec-sub">Konkrete Leistungen im Überblick.</p>
                  <div className="dir-prof-v2-spec-grid">
                    {methods.map((m) => (
                      <div key={m.id} className="dir-prof-v2-spec">
                        <i className="bi bi-check-circle-fill" aria-hidden />
                        {m.name}
                      </div>
                    ))}
                    {customMethodsPublic.map((label, idx) => (
                      <div key={`custom-method-${idx}-${label.slice(0, 24)}`} className="dir-prof-v2-spec">
                        <i className="bi bi-check-circle-fill" aria-hidden />
                        {label}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
              {showSpecSection ? (
                <section className="dir-prof-v2-sec" id="dir-spec">
                  <div className="dir-prof-v2-sec-label">
                    <i className="bi bi-mortarboard-fill" aria-hidden />
                    Spezialisierungen
                  </div>
                  <h2 className="dir-prof-v2-sec-h2">Schwerpunkte</h2>
                  <p className="dir-prof-v2-sec-sub">Worauf sich {profile.display_name} spezialisiert hat.</p>
                  <div className="dir-prof-v2-spec-grid">
                    {subcategories.map((s) => (
                      <div key={s.id} className="dir-prof-v2-spec">
                        <i className="bi bi-check-circle-fill" aria-hidden />
                        {s.name}
                      </div>
                    ))}
                    {customSpecsPublic.map((label, idx) => (
                      <div key={`custom-spec-${idx}-${label.slice(0, 24)}`} className="dir-prof-v2-spec">
                        <i className="bi bi-check-circle-fill" aria-hidden />
                        {label}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

          {showPremiumGallery ? (
            <section className="dir-prof-v2-sec" id="dir-gallery">
              <div className="dir-prof-v2-sec-label">
                <i className="bi bi-camera-fill" aria-hidden />
                Galerie
              </div>
              <h2 className="dir-prof-v2-sec-h2">Eindrücke</h2>
              <DirectoryProfileGalleryGrid
                photos={galleryWithUrl.map((m) => ({
                  id: m.id,
                  url: m.url!.trim(),
                  alt_text: m.alt_text,
                }))}
                displayName={profile.display_name}
              />
            </section>
          ) : null}

          <section className="dir-prof-v2-sec" id="dir-area">
            <div className="dir-prof-v2-sec-label">
              <i className="bi bi-geo-alt-fill" aria-hidden />
              Einsatzgebiet
            </div>
            <h2 className="dir-prof-v2-sec-h2">Standort &amp; Einsatzgebiet</h2>
            {mapCoords ? (
              <DirectoryProfileMapEmbed
                profileId={profile.id}
                slug={profile.slug}
                displayName={profile.display_name}
                lat={mapCoords.lat}
                lng={mapCoords.lng}
                city={profile.city}
                state={profile.state}
                radiusKm={mapRadiusKm}
              />
            ) : (
              <div className="dir-prof-v2-map-area dir-prof-v2-map-area--placeholder">
                <i className="bi bi-map-fill" aria-hidden />
                <span>
                  {mapLabelParts.length > 0
                    ? `${mapLabelParts.join(' · ')} — für die Karte fehlen Koordinaten im Profil.`
                    : 'Keine Koordinaten hinterlegt.'}
                </span>
              </div>
            )}
            <div className="dir-prof-v2-map-meta">
              {locLine ? (
                <span className="dir-prof-v2-mm">
                  <i className="bi bi-geo-alt-fill" aria-hidden />
                  {locLine}
                </span>
              ) : null}
              {hasRadius ? (
                <span className="dir-prof-v2-mm">
                  <i className="bi bi-crosshair2" aria-hidden />
                  {profile.service_radius_km} km Einsatzradius
                </span>
              ) : null}
              {hasArea ? (
                <span className="dir-prof-v2-mm">
                  <i className="bi bi-signpost-fill" aria-hidden />
                  {profile.service_area_text}
                </span>
              ) : null}
            </div>
          </section>

          <section className="dir-prof-v2-sec dir-prof-v2-sec--kontakt" id="profil-kontakt">
            <div className="dir-prof-v2-kontakt-card">
              <header className="dir-prof-v2-kontakt-card-head">
                <div className="dir-prof-v2-sec-label dir-prof-v2-kontakt-card-label">
                  <i className="bi bi-chat-dots-fill" aria-hidden />
                  Kontakt
                </div>
                <h2 className="dir-prof-v2-kontakt-card-h2">Kontakt &amp; Links</h2>
                {premiumContact ? (
                  <div className="dir-prof-v2-kontakt-intro">
                    <ul className="dir-prof-v2-kontakt-intro-list dir-prof-v2-kontakt-intro-list--centered">
                      <li>
                        <span className="dir-prof-v2-kontakt-intro-ic" aria-hidden>
                          <i className="bi bi-shield-lock-fill" />
                        </span>
                        <span>
                          Schreiben Sie direkt an <strong>{kontaktDirectName}</strong>. Ihre Nachricht wird per E-Mail
                          übermittelt und im Verzeichnis nicht angezeigt.
                        </span>
                      </li>
                    </ul>
                  </div>
                ) : null}
              </header>

              {premiumContact || phoneTelHref || socialSorted.length > 0 ? (
                <div
                  className={
                    (premiumContact && socialSorted.length > 0) ||
                    (!premiumContact && phoneTelHref && socialSorted.length > 0)
                      ? 'dir-prof-v2-kontakt-grid dir-prof-v2-kontakt-grid--split'
                      : 'dir-prof-v2-kontakt-grid'
                  }
                >
                  {premiumContact ? (
                    <div className="dir-prof-v2-kontakt-pane dir-prof-v2-kontakt-pane--form">
                      <div className="dir-prof-v2-kontakt-pane-head">
                        <h3 className="dir-prof-v2-kontakt-pane-h">
                          <i className="bi bi-envelope-paper-heart" aria-hidden />
                          Nachricht senden
                        </h3>
                        <p className="dir-prof-v2-kontakt-pane-sub">
                          Ihre Angaben werden ausschließlich an <strong>{profile.display_name}</strong> zur Bearbeitung
                          übermittelt — nicht im Verzeichnis sichtbar.
                        </p>
                      </div>
                      <DirectoryProfileContactForm
                        slug={profile.slug}
                        displayName={profile.display_name}
                        privacyInfoUrl={directoryAboutUrl()}
                      />
                    </div>
                  ) : null}

                  {!premiumContact && phoneTelHref ? (
                    <div
                      className={`dir-prof-v2-kontakt-pane dir-prof-v2-kontakt-pane--phone${
                        socialSorted.length === 0 ? ' dir-prof-v2-kontakt-pane--phone-solo' : ''
                      }`}
                    >
                      <div className="dir-prof-v2-kontakt-pane-head">
                        <h3 className="dir-prof-v2-kontakt-pane-h">
                          <i className="bi bi-telephone-fill" aria-hidden />
                          Telefon
                        </h3>
                        <p className="dir-prof-v2-kontakt-pane-sub">Öffnet die Telefon-App bzw. wählt die Nummer.</p>
                      </div>
                      <DirectoryProfileTrackedPhoneLink
                        slug={profile.slug}
                        href={phoneTelHref}
                        className="dir-prof-v2-kontakt-phone-row"
                      >
                        <span className="dir-prof-v2-kontakt-link-ic" aria-hidden>
                          <i className="bi bi-phone-vibrate-fill" />
                        </span>
                        <span className="dir-prof-v2-kontakt-link-body">
                          <span className="dir-prof-v2-kontakt-link-plat">Rufnummer</span>
                          <span className="dir-prof-v2-kontakt-link-url">{phonePublicDisplay}</span>
                        </span>
                        <span className="dir-prof-v2-kontakt-link-go" aria-hidden>
                          <i className="bi bi-chevron-right" />
                        </span>
                      </DirectoryProfileTrackedPhoneLink>
                    </div>
                  ) : null}

                  {socialSorted.length > 0 ? (
                    <div
                      className={`dir-prof-v2-kontakt-pane dir-prof-v2-kontakt-pane--links${
                        !premiumContact && !phoneTelHref ? ' dir-prof-v2-kontakt-pane--links-solo' : ''
                      }`}
                    >
                      <div className="dir-prof-v2-kontakt-pane-head">
                        <h3 className="dir-prof-v2-kontakt-pane-h">
                          <i className="bi bi-link-45deg" aria-hidden />
                          Web &amp; Social
                        </h3>
                        <p className="dir-prof-v2-kontakt-pane-sub">
                          Öffentlich hinterlegte Profile — öffnen in einem neuen Tab.
                        </p>
                      </div>
                      <div className="dir-prof-v2-kontakt-link-cards">
                        {socialSorted.map((l) => (
                          <a
                            key={l.id}
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="dir-prof-v2-kontakt-link-row"
                          >
                            <span className="dir-prof-v2-kontakt-link-ic" aria-hidden>
                              <i className={`bi ${socialPlatformIconClass(l.platform)}`} />
                            </span>
                            <span className="dir-prof-v2-kontakt-link-body">
                              <span className="dir-prof-v2-kontakt-link-plat">{socialPlatformLabel(l.platform)}</span>
                              <span className="dir-prof-v2-kontakt-link-url">
                                {l.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                              </span>
                            </span>
                            <span className="dir-prof-v2-kontakt-link-go" aria-hidden>
                              <i className="bi bi-box-arrow-up-right" />
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="dir-prof-v2-facts-sidebar" aria-label={`Kurzinfo: ${sidebarCardTitle}`}>
            <div className="dir-prof-v2-facts-sidebar-card-head">
              <h2 className="dir-prof-v2-facts-sidebar-card-title">{sidebarCardTitle}</h2>
              {sidebarCardTagline ? (
                <p className="dir-prof-v2-facts-sidebar-card-sub">{sidebarCardTagline}</p>
              ) : null}
              {socialSorted.length > 0 ? (
                <div className="dir-prof-v2-facts-sidebar-card-soc">
                  <div className="dir-prof-v2-facts-sidebar-soc-row">
                    {socialSorted.map((l) => (
                      <a
                        key={l.id}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="dir-prof-v2-facts-sidebar-soc-a"
                        title={socialPlatformLabel(l.platform)}
                      >
                        <i className={`bi ${socialPlatformIconClass(l.platform)}`} aria-hidden />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="dir-prof-v2-facts-sidebar-body">
              <h3 className="dir-prof-v2-facts-sidebar-h">Kontakt &amp; Standort</h3>
              <ul className="dir-prof-v2-facts-sidebar-list">
                <li className="dir-prof-v2-facts-sidebar-li">
                  <span className="dir-prof-v2-facts-sidebar-ic" aria-hidden>
                    <i className="bi bi-geo-alt-fill" />
                  </span>
                  <span className="dir-prof-v2-facts-sidebar-txt">
                    {addressLines.length > 0 ? (
                      addressLines.map((line, i) => (
                        <span key={i} className="dir-prof-v2-facts-sidebar-line">
                          {line}
                        </span>
                      ))
                    ) : (
                      <span className="dir-prof-v2-facts-sidebar-line">Keine Adresse hinterlegt</span>
                    )}
                  </span>
                </li>
                {phoneTelHref ? (
                  <li className="dir-prof-v2-facts-sidebar-li">
                    <span className="dir-prof-v2-facts-sidebar-ic" aria-hidden>
                      <i className="bi bi-phone-vibrate-fill" />
                    </span>
                    <span className="dir-prof-v2-facts-sidebar-txt">
                      <DirectoryProfileTrackedPhoneLink
                        slug={profile.slug}
                        href={phoneTelHref}
                        className="dir-prof-v2-facts-sidebar-phone"
                      >
                        {phonePublicDisplay}
                      </DirectoryProfileTrackedPhoneLink>
                    </span>
                  </li>
                ) : null}
                {hasRadius ? (
                  <li className="dir-prof-v2-facts-sidebar-li">
                    <span className="dir-prof-v2-facts-sidebar-ic" aria-hidden>
                      <i className="bi bi-crosshair2" />
                    </span>
                    <span className="dir-prof-v2-facts-sidebar-txt">
                      {profile.service_radius_km} km Einsatzradius
                    </span>
                  </li>
                ) : null}
                {hasArea ? (
                  <li className="dir-prof-v2-facts-sidebar-li">
                    <span className="dir-prof-v2-facts-sidebar-ic" aria-hidden>
                      <i className="bi bi-signpost-fill" />
                    </span>
                    <span className="dir-prof-v2-facts-sidebar-txt">{profile.service_area_text}</span>
                  </li>
                ) : null}
              </ul>
              {showOpeningBlock ? (
                <div className="dir-prof-v2-facts-sidebar-hours">
                  <DirectoryProfileSidebarHoursDisclosure
                    lines={openingLines}
                    todayKey={openingHoursTodayKey}
                    note={openingHoursNote || null}
                  />
                </div>
              ) : null}
              <a href="#profil-kontakt" className="dir-prof-v2-facts-sidebar-cta">
                <i
                  className={premiumContact ? 'bi bi-envelope-fill' : 'bi bi-chat-dots-fill'}
                  aria-hidden
                />
                {premiumContact ? 'Nachricht senden' : 'Links & Kontakt'}
              </a>
            </div>
          </aside>
      </div>

      {profile.claim_state !== 'claimed' ? (
        <div className="dir-prof-v2-claim-sec">
          <div className="dir-prof-v2-claim-in">
            <div className="dir-prof-v2-cl-left">
              <div className="dir-prof-v2-cl-badge">
                <i className="bi bi-person-check-fill" aria-hidden />
                Ist das dein Profil?
              </div>
              <h2 className="dir-prof-v2-cl-title">Übernimm dein Profil auf anidocs</h2>
              <p className="dir-prof-v2-cl-desc">
                Werde sichtbar für Tierhalter in deiner Region. Bearbeite deine Daten, erhalte Anfragen und nutze die
                anidocs Software für deine Praxis.
              </p>
              <div className="dir-prof-v2-cl-feats">
                <span className="dir-prof-v2-cl-feat">
                  <i className="bi bi-check-circle-fill" aria-hidden />
                  Online gefunden werden
                </span>
                <span className="dir-prof-v2-cl-feat">
                  <i className="bi bi-check-circle-fill" aria-hidden />
                  Anfragen erhalten
                </span>
                <span className="dir-prof-v2-cl-feat">
                  <i className="bi bi-check-circle-fill" aria-hidden />
                  Dokumentation &amp; Rechnungen
                </span>
                <span className="dir-prof-v2-cl-feat">
                  <i className="bi bi-check-circle-fill" aria-hidden />
                  14 Tage kostenlos
                </span>
              </div>
            </div>
            <div className="dir-prof-v2-cl-right">
              <Link href={claimHref} className="dir-prof-v2-cl-btn dir-prof-v2-cl-btn--p">
                Profil kostenlos übernehmen
              </Link>
              <a href={aboutHref} className="dir-prof-v2-cl-btn dir-prof-v2-cl-btn--s">
                Mehr erfahren
              </a>
            </div>
          </div>
        </div>
      ) : null}

      <DirectoryProfileMobBarShell className="dir-prof-v2-mob-bar" aria-label="Schnellaktionen">
        <div className="dir-prof-v2-mob-bar-in">
          <DirectoryProfileShareButton
            url={shareUrl}
            title={profile.display_name}
            analyticsSlug={profile.slug}
            className="dir-prof-v2-mob-share"
            variant="secondary"
          >
            <i className="bi bi-share" aria-hidden />
          </DirectoryProfileShareButton>
          <DirectoryProfileMobBarCtaReveal
            quickCtaRootId="dir-prof-quick-cta"
            slug={profile.slug}
            phoneTelHref={phoneTelHref}
            premiumContact={premiumContact}
          />
        </div>
      </DirectoryProfileMobBarShell>
    </div>
  )
}
