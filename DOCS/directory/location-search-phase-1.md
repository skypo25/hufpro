# Phase 1: Umkreissuche (öffentliches Verzeichnis)

## Ziel

Nutzer:innen geben **Ort oder PLZ** ein, wählen einen **Umkreis** (5 / 10 / 25 / 50 km) und sehen **veröffentlichte** Tierbehandler-Profile **sortiert nach Entfernung**, mit **km-Angabe** in der Liste. **Keine Karte**, **keine Browser-Geolocation** in dieser Phase.

## Bestandsprüfung (Schema & View)

| Thema | Stand |
|--------|--------|
| `directory_profiles.latitude` / `longitude` | In der Basistabelle vorhanden; Constraint: beide gesetzt oder beide NULL. Btree-Index auf `(latitude, longitude)` wo gesetzt. |
| `service_radius_km` | Profilfeld „Einsatz-/Angebotsradius“ des Behandlers; **Phase 1 nutzt es nicht** für die öffentliche Umkreissuche. Die Suchradius-Logik kommt aus der URL (`radiusKm`). Später denkbar: Schnittmenge „Nutzer-Umkreis“ ∩ „Behandler reicht bis …“ für mobile Angebote. |
| `directory_public_profiles` | **Migration `20260409100000_directory_public_profiles_geo.sql`:** View um `latitude`, `longitude` erweitert (nur published). Vorher waren Koordinaten absichtlich nicht public — für Phase 1 nötig. |

## Technische Entscheidung (kurz)

- **Distanz:** **Haversine** in TypeScript nach **Bounding-Box-Filter** in Postgres (über Supabase). **Kein PostGIS** in Phase 1 — weniger Betriebs-/Migrationsrisiko, für deutschlandweit übliche Datenmengen ausreichend. Obergrenze aktuell **2000** Treffer innerhalb der Box (`NEARBY_FETCH_CAP` in `lib/directory/public/data.ts`); bei Wachstum anpassen oder RPC/PostGIS evaluieren.
- **Suchpunkt-Geocoding:** Optionaler HTTP-Call zu **Nominatim-kompatibler** Suche (`lib/directory/public/geocodeLocation.ts`). **Ohne** gesetztes `DIRECTORY_GEOCODING_USER_AGENT` findet **kein** externer Geocode statt → automatischer Fallback auf **textuelle** Suche (`city` / `postal_code` ilike), wie zuvor.

### Empfehlung Geocoding (Betrieb)

| Option | Phase 1 | Produktion |
|--------|---------|------------|
| **Öffentliches Nominatim** | Okay zum Testen mit **sehr geringer** Last, strikter User-Agent, `countrycodes=de`. | Nur bedingt (Richtlinien, Rate-Limits). |
| **Eigene Nominatim-Instanz / kommerziell (Mapbox, Google, OpenCage, …)** | Optional über `DIRECTORY_GEOCODE_BASE_URL` + gleiche Response-Form nicht garantiert — bei Wechsel Adapter anpassen. | **Empfohlen** für stabile Nutzung. |

**Konkrete Empfehlung:** Phase 1 mit **env-gesteuertem** Nominatim-Endpoint + Pflicht-**User-Agent** starten; für anidocs.de zeitnah **eigenen Geocoder** oder kommerziellen Dienst mit SLA wählen.

## URL-Parameter

| Parameter | Bedeutung |
|-----------|-----------|
| `location` | Freitext Ort/PLZ (Primär). Legacy: `city` wird beim Parsen gleich behandelt. |
| `radiusKm` | `5` \| `10` \| `25` \| `50`. **Default 25** — wird in Links weggelassen, wenn 25. |
| `specialtyId`, `animalTypeId`, `serviceType`, `page` | unverändert |

Parsing & Linkbau: `lib/directory/public/listingParams.ts`.

## Geocoding-Strategie für Profile (Konzept, nicht voll automatisiert in Phase 1)

**Ziel:** Jedes veröffentlichte Profil mit sinnvollem Standort sollte **latitude/longitude** tragen.

1. **Quelle der Adresse:** Bevorzugt vollständige Anschrift (Straße, Hausnummer, PLZ, Ort, Land) aus dem Directory-Profil; Fallback **PLZ + Ort** (und Land), wenn keine Straße vorliegt — schlechtere Geocode-Qualität, aber robust.
2. **Wann rechnen:**  
   - **Import:** Batch-Geocoding nach Import (oder asynchroner Job) ist skalierbar.  
   - **Bei Änderung** der Adresse im Verzeichnis-Backend: einzeln nachziehen.  
3. **Konservativ:** Fehlschläge protokollieren, Koordinaten leer lassen, Profil kann weiter per **Textsuche** gefunden werden; in der **Umkreissuche** erscheint es ohne Koordinaten **nicht**.

Umsetzung im Code: in Phase 1 **nicht** enthalten — nur Doku und Datenfelder.

## Fallback-Verhalten (öffentliche Suche)

1. **Geocoding deaktiviert** (`DIRECTORY_GEOCODING_USER_AGENT` fehlt): Hinweisbanner, **textuelle** Suche auf `location`, **keine** km.
2. **Geocoding ohne Treffer:** Warnbanner, **textuelle** Suche, **keine** km.
3. **Profile ohne Koordinaten:** In der **Umkreissuche** nicht in der Ergebnisliste; Textsuche bleibt möglich.
4. **0 Treffer bei Umkreis:** Empty-State-Hinweis, Radius zu vergrößern / Ort zu ändern.

## Umgebungsvariablen

| Variable | Beschreibung |
|----------|----------------|
| `DIRECTORY_GEOCODING_USER_AGENT` | **Pflicht** für externen Geocode-Call (Nominatim-Richtlinie). Z. B. `AniDocs Verzeichnis (https://anidocs.de)`. |
| `DIRECTORY_GEOCODE_BASE_URL` | Optional, Default `https://nominatim.openstreetmap.org` (ohne trailing slash). |

## Bewusst nicht in Phase 1

- Karte, Cluster, Browser-Geolocation  
- PostGIS / Geography-Spalte  
- Nutzung von `service_radius_km` in der Filterlogik  
- Automatisches Profil-Geocoding im Import (nur beschrieben)  
- Schwere Client-Libraries im Verzeichnis  

## Code-Referenzen

- View-Migration: `supabase/migrations/20260409100000_directory_public_profiles_geo.sql`  
- Listing-Logik: `lib/directory/public/data.ts` (`listPublicProfiles`, `listPublicProfilesNear`)  
- Haversine / Bounding-Box: `lib/directory/public/haversine.ts`  
- Geocoding: `lib/directory/public/geocodeLocation.ts`  
- UI: `app/(directory)/behandler/page.tsx`, `DirectoryListingSearchStrip`, `DirectoryProfileCard` (Distanzzeile)  

## Guardrails

Öffentliches Verzeichnis bleibt **Server-first**; Geocoding läuft **nur serverseitig**. Keine neuen globalen Client-Bundles für den Arbeitsbereich.
