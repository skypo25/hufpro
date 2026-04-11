# Directory: Fachrichtungen, Spezialisierungen, Methoden

Dokumentation zum erweiterten **fachlichen Datenmodell** des öffentlichen Tierbehandler-Verzeichnisses (AniDocs). UI und Listing-Filter für Subcategories/Methoden können schrittweise angebunden werden; dieses Dokument beschreibt **Tabellen, Beziehungen, Seeds und Zugriff**.

## Überblick der fachlichen Ebenen

| Ebene | Tabelle(n) | Profil-Zuordnung | Öffentliche View(s) |
|--------|------------|------------------|---------------------|
| **Fachrichtung** (Hauptkategorie) | `directory_specialties` | `directory_profile_specialties` (n:m, optional `is_primary`) | `directory_public_specialties`, `directory_public_profile_specialties` |
| **Spezialisierung** (Unterkategorie) | `directory_subcategories` | `directory_profile_subcategories` | `directory_public_subcategories`, `directory_public_profile_subcategories` |
| **Methode / Leistung** | `directory_methods` | `directory_profile_methods` | `directory_public_methods`, `directory_public_profile_methods` |
| **Tierart** | `directory_animal_types` | `directory_profile_animal_types` | `directory_public_animal_types`, `directory_public_profile_animal_types` |
| **mobil / Praxis** | `directory_profiles.service_type` | Spalte am Profil | `directory_public_profiles.service_type` |
| **Einsatzradius** | `directory_profiles.service_radius_km` | Spalte am Profil | `directory_public_profiles.service_radius_km` |
| **Beschreibung** | `directory_profiles` (`short_description`, `description`, …) | Owner-Update | Public-View je nach Freigabe |

## Fachrichtungen (`directory_specialties`)

Bereits im MVP vorhanden: `code`, `name`, `description`, `sort_order`, `is_active`, optional `parent_specialty_id` (Hierarchie für Sonderfälle).

**Aktive Hauptkategorien (Zielbild):**

1. `tierphysiotherapie` — Tierphysiotherapie  
2. `tierosteopathie` — Tierosteopathie  
3. `tierheilpraktik` — Tierheilpraktik  
4. `hufschmied` — Hufschmied  
5. `barhufbearbeitung` — Barhufbearbeitung (eigenständig, nicht mehr Kind von „Hufbearbeitung“)

**Historisch / technisch:**

- `hufbearbeitung` bleibt als Zeile bestehen (FK-Stabilität), ist aber **`is_active = false`** und erscheint nicht in `directory_public_specialties`.

**Optional vorbereitet (`is_active = false`):**

- `tierchiropraktik`, `tierernaehrungsberatung`, `tierverhaltenstherapie`, `tierzahnarzt`, `sattler`

Migration: `supabase/migrations/20260410120000_directory_subcategories_methods.sql` (inkl. Updates an Fachrichtungen).

## Spezialisierungen (`directory_subcategories`)

| Spalte | Typ | Beschreibung |
|--------|-----|----------------|
| `id` | uuid | PK |
| `code` | text | Stabil, eindeutig (z. B. `tp_rehabilitation`) |
| `name` | text | Anzeigename |
| `directory_specialty_id` | uuid | FK → `directory_specialties.id` |
| `sort_order` | int | Reihenfolge |
| `is_active` | bool | Referenz ausblendbar |

**n:m Profil:** `directory_profile_subcategories` (`directory_profile_id`, `directory_subcategory_id`, unique pro Paar).

Seeds: je Fachrichtung die im Lastenheft genannten Spezialisierungen (siehe Migration, Abschnitt „Seeds: Spezialisierungen“).

## Methoden / Leistungen (`directory_methods`)

| Spalte | Typ | Beschreibung |
|--------|-----|----------------|
| `id` | uuid | PK |
| `code` | text | Stabil, eindeutig |
| `name` | text | Anzeigename |
| `directory_specialty_id` | uuid, **nullable** | Zuordnung zur Fachrichtung für Gruppierung/Filter; `NULL` wäre „branchenübergreifend“ (aktuell nicht genutzt) |
| `sort_order` | int | Reihenfolge |
| `is_active` | bool | Referenz ausblendbar |

**n:m Profil:** `directory_profile_methods` (`directory_profile_id`, `directory_method_id`, unique pro Paar).

Seeds: Physio-, Osteo-, THP-, Hufschmied- und Barhuf-Methoden gemäß Vorgabe (siehe Migration).

## Beziehungen (Diagramm, vereinfacht)

```text
directory_specialties
       ↑                    ↑
       │                    │
directory_subcategories   directory_methods
       ↑                    ↑
       │                    │
directory_profile_*        directory_profile_*
       \                    /
        → directory_profiles ← directory_profile_animal_types → directory_animal_types
```

`directory_profile_specialties` verbindet Profil ↔ Fachrichtung (mehrere erlaubt, max. ein `is_primary` pro Profil).

## RLS & Owner-Bearbeitung

- **Referenztabellen** `directory_subcategories`, `directory_methods`: `authenticated` darf nur **aktive** Zeilen lesen (Policies analog zu `directory_specialties`).
- **Junctions** `directory_profile_subcategories`, `directory_profile_methods`: **SELECT/INSERT/UPDATE/DELETE** nur, wenn `directory_profiles.claimed_by_user_id = auth.uid()` (gleiches Muster wie `directory_profile_specialties` / `directory_profile_animal_types`).
- **`directory_profiles`:** Owner-Update bereits für Beschreibung, `service_type`, `service_radius_km` etc. (bestehende Policies).

Damit kann ein Behandler nach Claim (oder gleichwertiger Owner-Rolle) **Fachrichtungen, Spezialisierungen, Methoden, Tierarten** sowie **mobil/Praxis, Radius, Texte** pflegen — die konkrete UI folgt später.

## Öffentlicher Read (Filter & Profilseite)

- **Anon:** nur über Views `directory_public_*` (kein Direktzugriff auf Basistabellen).
- Für Filter/Listings später z. B.:
  - Fachrichtung: weiter über `directory_public_profile_specialties` + `specialtyId`
  - Spezialisierung: Join über `directory_public_profile_subcategories` + `directory_subcategory_id`
  - Methode: Join über `directory_public_profile_methods` + `directory_method_id`
  - Tierart, `service_type`, Ort/Radius: unverändert über bestehende Felder/Queries erweiterbar

TypeScript-Typen (Public-Rows): `lib/directory/public/types.ts` (`DirectoryPublicSubcategoryRow`, `DirectoryPublicMethodRow`, …).

## Frontend / Import-Anpassungen

- Startseiten-Kacheln und Schnell-Tags nutzen die **fünf aktiven** Hauptcodes inkl. `hufschmied` und `barhufbearbeitung` (statt inaktivem `hufbearbeitung`).
- Import-Aliase: `lib/directory/import/aliases.ts` (z. B. `hufschmied`, `beschlag` → `hufschmied`).

## Nächste Schritte (außerhalb dieses Schritts)

- Server-Actions / API zum Lesen der Referenzlisten für Owner-UI.
- Öffentliche Profilseite: Badges aus Subcategories + Methods (Labels via Join auf Public-Views).
- Listing: Query-Parameter und `listPublicProfiles`-Erweiterung für `subcategoryId` / `methodId`.
