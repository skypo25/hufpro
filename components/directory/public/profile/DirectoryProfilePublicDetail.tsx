import Link from 'next/link'
import type {
  DirectoryPublicAnimalTypeRow,
  DirectoryPublicMethodRow,
  DirectoryPublicProfileMediaRow,
  DirectoryPublicProfileRow,
  DirectoryPublicProfileSocialRow,
  DirectoryPublicSimilarProfileRow,
  DirectoryPublicSpecialtyRow,
  DirectoryPublicSubcategoryRow,
} from '@/lib/directory/public/types'
import {
  directoryAboutUrl,
  directoryProfileCreateHref,
  directoryPublicProfileAbsoluteUrl,
} from '@/lib/directory/public/appBaseUrl'
import {
  directoryWeekdayKeyEuropeBerlin,
  formatOpeningHoursForDisplay,
  hasPublicOpeningHoursDisplay,
  normalizeOpeningHoursJson,
} from '@/lib/directory/openingHours'
import {
  countryDachLabel,
  serviceTypeLabel,
  socialPlatformIconClass,
  socialPlatformLabel,
} from '@/lib/directory/public/labels'
import {
  formatPublicPhoneForDisplay,
  formatPublicPhoneTelHref,
} from '@/lib/directory/public/formatPublicPhone'
import {
  profileAvatarBackground,
  profileInitials,
  publicProfileSidebarCardTagline,
  publicProfileSidebarCardTitle,
  publicProfileStreetLine,
} from '@/lib/directory/public/profileDisplay'
import {
  descriptionTextForPublicAbout,
  parseCustomMethodsFromDescription,
  parseCustomSpecsFromDescription,
} from '@/lib/directory/onboarding/parseWizardDescriptionBlocks'

import { DirectoryProfileGalleryGrid } from './DirectoryProfileGalleryGrid'
import { DirectoryProfileMapEmbed } from './DirectoryProfileMapEmbed'
import { ProfileBentoPawIcon } from './ProfileBentoPawIcon'
import { ProfileBentoSpecialtyIcon } from './ProfileBentoSpecialtyIcon'
import { DirectoryProfileSectionTabs } from './DirectoryProfileSectionTabs'
import { DirectoryProfileShareButton } from './DirectoryProfileShareButton'
import { ProfileHeroBlock } from './ProfileHeroBlock'

export function DirectoryProfilePublicDetail({
  profile,
  specialties,
  animalTypes,
  subcategories,
  methods,
  media,
  social,
  similarProfiles,
}: {
  profile: DirectoryPublicProfileRow
  specialties: DirectoryPublicSpecialtyRow[]
  animalTypes: DirectoryPublicAnimalTypeRow[]
  subcategories: DirectoryPublicSubcategoryRow[]
  methods: DirectoryPublicMethodRow[]
  media: DirectoryPublicProfileMediaRow[]
  social: DirectoryPublicProfileSocialRow[]
  similarProfiles: DirectoryPublicSimilarProfileRow[]
}) {
  const profileCreateHref = directoryProfileCreateHref()
  const aboutHref = directoryAboutUrl()
  const claimHref = `/behandler/${profile.slug}/claim`
  const shareUrl = directoryPublicProfileAbsoluteUrl(profile.slug)
  const socialSorted = [...social].sort((a, b) => a.sort_order - b.sort_order)
  const withUrl = media.filter((m) => m.url && m.url.trim() !== '')
  /** Nur Galerie-Fotos, kein Logo (Logo bleibt im Hero). */
  const galleryWithUrl = media
    .filter((m) => m.media_type === 'photo' && m.url && m.url.trim() !== '')
    .sort((a, b) => a.sort_order - b.sort_order)
  const logoUrl = media.find((m) => m.media_type === 'logo' && m.url?.trim())?.url?.trim()
  const heroImageUrl = logoUrl || (withUrl[0]?.url?.trim() ? withUrl[0].url : null)
  const sidebarCardTitle = publicProfileSidebarCardTitle(profile)
  const sidebarCardTagline = publicProfileSidebarCardTagline(
    profile,
    specialties.map((s) => s.name)
  )

  const hasShort = Boolean(profile.short_description?.trim())
  const aboutLongText = descriptionTextForPublicAbout(profile.description)
  const hasLongDisplay = Boolean(aboutLongText?.trim())
  /** Ohne Social (siehe Sidebar/Kontakt); langer Text ohne Chip-Blöcke „Eigene …“. */
  const hasAboutSection = hasShort || hasLongDisplay

  const customSpecsPublic = parseCustomSpecsFromDescription(profile.description)
  const customMethodsPublic = parseCustomMethodsFromDescription(profile.description)
  const showMethodsSection = methods.length > 0 || customMethodsPublic.length > 0
  const showSpecSection = subcategories.length > 0 || customSpecsPublic.length > 0

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
  if (showMethodsSection) tabs.push({ id: 'dir-methods', label: 'Leistungen' })
  if (showSpecSection) tabs.push({ id: 'dir-spec', label: 'Spezialisierungen' })
  if (galleryWithUrl.length > 0) tabs.push({ id: 'dir-gallery', label: 'Galerie' })
  tabs.push({ id: 'dir-area', label: 'Einsatzgebiet' })

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
      <div className="dir-prof-v2-hero-wrap">
        <ProfileHeroBlock
          profile={profile}
          specialties={specialties}
          animalTypes={animalTypes}
          heroImageUrl={heroImageUrl}
        />
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
                    <div className="dir-prof-v2-bc-val">{specialties[0]!.name}</div>
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
                  {specialties.map((spec) => (
                    <div key={spec.id} className="dir-prof-v2-bc">
                      <div className="dir-prof-v2-bc-icon">
                        <ProfileBentoSpecialtyIcon code={spec.code} />
                      </div>
                      <div className="dir-prof-v2-bc-lab">Fachrichtung</div>
                      <div className="dir-prof-v2-bc-val">{spec.name}</div>
                    </div>
                  ))}
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

          {galleryWithUrl.length > 0 ? (
            <section className="dir-prof-v2-sec" id="dir-gallery">
              <div className="dir-prof-v2-sec-label">
                <i className="bi bi-camera-fill" aria-hidden />
                Galerie
              </div>
              <h2 className="dir-prof-v2-sec-h2">Eindrücke</h2>
              <p className="dir-prof-v2-sec-sub dir-prof-v2-gal-intro">
                Kacheln im Verhältnis 16:9 (quer) bzw. 9:16 (hoch). Klick öffnet die Großansicht; Pfeiltasten oder die
                Seiten-Buttons blättern zwischen den Bildern.
              </p>
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

          <section className="dir-prof-v2-sec" id="profil-kontakt">
            <div className="dir-prof-v2-sec-label">
              <i className="bi bi-chat-dots-fill" aria-hidden />
              Kontakt
            </div>
            <h2 className="dir-prof-v2-sec-h2">Kontakt &amp; Links</h2>
            <p className="dir-prof-v2-sec-sub">
              {phoneTelHref
                ? 'E-Mail wird in diesem Verzeichnis nicht angezeigt. Telefon siehe „Kontakt & Standort“ in der Seitenleiste oder die hinterlegten Links.'
                : 'Telefon und E-Mail werden in diesem Verzeichnis nicht angezeigt. Nutzen Sie die hinterlegten Links.'}
            </p>
            <div className="dir-prof-v2-h-actions dir-prof-v2-kontakt-actions">
              {socialSorted[0] ? (
                <a
                  href={socialSorted[0].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dir-prof-v2-ha dir-prof-v2-ha--p"
                >
                  <i className="bi bi-box-arrow-up-right" aria-hidden />
                  {socialPlatformLabel(socialSorted[0].platform)} öffnen
                </a>
              ) : (
                <span className="dir-prof-v2-sec-sub">Noch keine Kontaktlinks hinterlegt.</span>
              )}
              <a href={profileCreateHref} className="dir-prof-v2-ha dir-prof-v2-ha--s">
                <i className="bi bi-person-plus-fill" aria-hidden />
                Eigenes Profil erstellen
              </a>
            </div>
            {socialSorted.length > 1 ? (
              <ul className="dir-prof-v2-cc-list">
                {socialSorted.map((l) => (
                  <li key={l.id}>
                    <i className="bi bi-link-45deg" aria-hidden />
                    <div>
                      <div className="dir-prof-v2-cc-lab">{socialPlatformLabel(l.platform)}</div>
                      <a href={l.url} target="_blank" rel="noopener noreferrer">
                        {l.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {similarProfiles.length > 0 ? (
            <section className="dir-prof-v2-sec">
              <div className="dir-prof-v2-sec-label">
                <i className="bi bi-people-fill" aria-hidden />
                Weitere Behandler
              </div>
              <h2 className="dir-prof-v2-sec-h2">Ähnliche Behandler in der Nähe</h2>
              <div className="dir-prof-v2-sim-scroll">
                {similarProfiles.map((p) => (
                  <Link key={p.id} href={`/behandler/${p.slug}`} className="dir-prof-v2-sim">
                    <div
                      className="dir-prof-v2-sim-av"
                      style={{ background: profileAvatarBackground(p.slug), color: '#154226' }}
                    >
                      {profileInitials(p.display_name)}
                    </div>
                    <div className="dir-prof-v2-sim-name">{p.display_name}</div>
                    <div className="dir-prof-v2-sim-fach">{p.primary_specialty_label ?? 'Tierbehandler:in'}</div>
                    <div className="dir-prof-v2-sim-loc">
                      <i className="bi bi-geo-alt-fill" aria-hidden />
                      {p.city ?? p.state ?? '—'}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
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
                      <a href={phoneTelHref} className="dir-prof-v2-facts-sidebar-phone">
                        {phonePublicDisplay}
                      </a>
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
                  <h3 className="dir-prof-v2-facts-sidebar-h">Öffnungszeiten &amp; Erreichbarkeit</h3>
                  {openingLines.length > 0 ? (
                    <dl className="dir-prof-v2-facts-sidebar-hours-dl">
                      {openingLines.map((line) => (
                        <div
                          key={line.key}
                          className={
                            line.key === openingHoursTodayKey
                              ? 'dir-prof-v2-facts-sidebar-hours-row dir-prof-v2-facts-sidebar-hours-row--today'
                              : 'dir-prof-v2-facts-sidebar-hours-row'
                          }
                        >
                          <dt>{line.label}</dt>
                          <dd>{line.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {openingHoursNote ? (
                    <p className="dir-prof-v2-facts-sidebar-hours-note">{openingHoursNote}</p>
                  ) : null}
                </div>
              ) : null}
              <a href="#profil-kontakt" className="dir-prof-v2-facts-sidebar-cta">
                <i className="bi bi-chat-dots-fill" aria-hidden />
                Links &amp; Kontakt
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

      <nav className="dir-prof-v2-mob-bar" aria-label="Schnellaktionen">
        <div className="dir-prof-v2-mob-bar-in">
          <DirectoryProfileShareButton
            url={shareUrl}
            title={profile.display_name}
            className="dir-prof-v2-mob-share"
            variant="secondary"
          >
            <i className="bi bi-share" aria-hidden />
          </DirectoryProfileShareButton>
          <a href="#profil-kontakt" className="dir-prof-v2-ha dir-prof-v2-ha--p dir-prof-v2-mob-msg">
            <i className="bi bi-envelope-fill" aria-hidden />
            Nachricht schreiben
          </a>
        </div>
      </nav>
    </div>
  )
}
