# Öffentliches Tierbehandler-Verzeichnis (Lese-MVP)

## Routen

| URL | Beschreibung |
|-----|----------------|
| `/behandler` | Listing mit Filtern (GET-Formular, Server Components) |
| `/behandler/[slug]` | Öffentliches Profil (nur `listing_status = published` über Views) |
| `/behandler/[slug]/claim` | Profil beanspruchen (eingeloggt); Insert in `directory_claims` |

Implementierung: `app/(directory)/` (Route-Gruppe ohne URL-Präfix), eigenes Layout mit `DirectoryPublicShell`. **Kein** Code im Arbeitsbereich `(app)`.

### Claim: nötige DB-Migration

Der Claim-Insert nutzt u. a. `claimant_display_name`, `claimant_email`, `message`, `proof_url`. Diese Spalten kommen aus **`supabase/migrations/20260407140000_directory_claims_application_fields.sql`**. Ohne angewendete Migration meldet PostgREST z. B. *Could not find the 'claimant_display_name' column … in the schema cache*.

**Behebung:** Migration auf der Ziel-Datenbank ausführen (z. B. `supabase db push`, oder SQL aus der Datei im Supabase SQL Editor).

**RLS-Fehler beim Speichern** (*violates row-level security policy for table ‚directory_claims‘*): Die INSERT-Policy prüft das Profil per Subquery; ohne Hilfsfunktion sieht `authenticated` unclaimed Zeilen in `directory_profiles` nicht. Migration **`20260407150000_directory_claim_insert_rls_helper.sql`** ersetzt die Policy durch eine Prüfung über `directory_profile_is_claimable(uuid)` (SECURITY DEFINER).

## Daten

Alle Lesevorgänge über **`lib/directory/public/data.ts`** und ausschließlich diese **Postgres-Views**:

- `directory_public_profiles`
- `directory_public_specialties`
- `directory_public_animal_types`
- `directory_public_profile_specialties`
- `directory_public_profile_animal_types`
- `directory_public_profile_media`
- `directory_public_profile_social_links`

Query-Parameter: Normalisierung in `lib/directory/public/listingParams.ts` (u. a. ungültige UUIDs für Filter werden ignoriert).

## Filter (Listing)

- **Ort oder PLZ** (`city`) — durchsucht `city` und `postal_code` (ilike, Eingabe bereinigt für PostgREST-`.or()`).
- **Fachrichtung** (`specialtyId` — UUID der Referenzzeile).
- **Tierart** (`animalTypeId`).
- **Angebotsform** (`serviceType`: `stationary` | `mobile` | `both`).
- **Pagination** (`page`) — Seite wird an die Trefferzahl angepasst; bei Abweichung Redirect auf kanonische URL.

## Komponenten-Struktur (HTML-Layout später)

Ziel: Blöcke sind getrennt und mit `data-directory-*` markiert, damit nachgeliefertes HTML/CSS einfach eingebaut werden kann.

| Bereich | Pfad / Hinweis |
|---------|----------------|
| Listing-Intro | `components/directory/public/listing/DirectoryListingIntro.tsx` — `data-directory-section="intro"` |
| Filter | `DirectoryListingFilters.tsx` — `data-directory-section="filters"` |
| Leerzustand | `listing/DirectoryListingEmptyState.tsx` |
| Ergebnisraster | `listing/DirectoryListingResultsGrid.tsx` — `data-directory-section="results"` |
| Karte | `DirectoryProfileCard.tsx` — `data-directory-card`, `data-directory-block="…"` |
| Pagination | `DirectoryListingPagination.tsx` |
| Profil | `profile/DirectoryProfilePublicDetail.tsx` + `ProfileHeroBlock` — Layout an Mock angelehnt (`dir-prof-*` in `globals.css`); Zurück-Link in `DirectoryPublicNav` auf Profilseiten. Keine Telefon/E-Mail in der Public-View (MVP). |

**Visuelles Feintuning / finales Markup:** bewusst zurückgestellt bis zur HTML-Vorlage im nächsten Schritt.

## SEO

- Listing: dynamisches `generateMetadata` (Titel/Description abhängig von Filtern; Lookup Fachrichtung/Tierart-Name über Views).
- Profil: `generateMetadata` mit individuellem Titel, gekürzter Description, `alternates.canonical`, `robots`.
- Optional: `NEXT_PUBLIC_DIRECTORY_SITE_URL` oder `NEXT_PUBLIC_SITE_URL` für `metadataBase` im `(directory)/layout.tsx` (Marketing-Domain).

## Umkreissuche (Phase 1)

Ort/PLZ + Radius auf `/behandler`, Distanz in km, ohne Karte. Siehe **[location-search-phase-1.md](./location-search-phase-1.md)** (Schema, Env, Fallbacks).

## Listing-Hero (Header-Bild)

Lege dein Bild am besten als **`public/directory/behandler-hero.webp`** ab (alternativ `.jpg` oder `.png`). Reihenfolge der Suche siehe `lib/directory/public/heroImage.ts`:

1. `behandler-hero.webp` · `behandler-hero.jpg` · `behandler-hero.png`
2. `anidocs-header-portal.png` · `anidocs-header-portal.jpg`
3. `public/images/hero-animals.png` · `.jpg` · `.webp` (Mock-Name)

Ohne Treffer: weicher Platzhalter-Gradient im Hero (kein kaputter Bild-Link).

## Annahmen

- Öffentliche Bild-URLs aus der View: `<img>` ohne `next/image` (Remote-Patterns).
- App-Link in der Shell: `NEXT_PUBLIC_APP_URL` + `/login`, sonst `/login`.
