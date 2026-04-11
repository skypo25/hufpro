# Tierbehandler-Verzeichnis: Referenz-Seeds & Importpfad

Interne Kurzdoku für `directory_specialties`, `directory_animal_types` und den ersten JSON-Import (Service Role).

Siehe auch: `docs/architecture/directory-guardrails.md`, **[data-model-specialties-subcategories-methods.md](./data-model-specialties-subcategories-methods.md)** (Fachmodell inkl. Spezialisierungen & Methoden).

---

## 1. Seed-Daten Fachrichtungen (`directory_specialties`)

**Aktuell (nach `20260410120000_directory_subcategories_methods.sql`):** fünf **aktive** Hauptfächer; `hufbearbeitung` ist **inaktiv** (historisch); optionale Fächer angelegt mit `is_active = false`.

| code | name (Ziel) | sort_order | Hinweis |
|------|-------------|------------|---------|
| `tierphysiotherapie` | Tierphysiotherapie | 10 | aktiv |
| `tierosteopathie` | Tierosteopathie | 20 | aktiv |
| `tierheilpraktik` | Tierheilpraktik | 30 | aktiv |
| `hufschmied` | Hufschmied | 40 | aktiv |
| `barhufbearbeitung` | Barhufbearbeitung | 50 | aktiv, kein Parent |
| `hufbearbeitung` | Hufbearbeitung | 40 | **inaktiv** (Legacy) |

Erste Anlage / Idempotenz: weiterhin `supabase/migrations/20260406140000_directory_reference_seed.sql`; Anpassungen und Subcategories/Methods: **`20260410120000_directory_subcategories_methods.sql`**.

---

## 1b. Testprofile (Neustart, neues Fachmodell)

**Migration:** `supabase/migrations/20260411100000_directory_test_profiles_reset.sql`

- **Zweck:** Alle bisherigen **profilbezogenen** Directory-Daten werden entfernt (`TRUNCATE directory_profiles CASCADE` — inkl. Junctions, Claims, Quellen, Social, Medien). **Referenztabellen** (Fachrichtungen, Tierarten, Subcategories, Methoden) bleiben unangetastet.
- **Warum:** Alte Testdaten stützten sich u. a. auf **`hufbearbeitung`** als Hauptkategorie und hatten **keine** Zuordnungen zu Spezialisierungen/Methoden. Für Entwicklung und Umkreistests ist ein konsistenter Satz auf dem **aktuellen Modell** sinnvoller als eine partielle Migration.
- **Neu:** **20** veröffentlichte Testprofile (`listing_status = published`, `claim_state = unclaimed`), Slug-Präfix **`test-anidocs-`**, fiktive Namen/Texte, **Koordinaten** in Deutschland, je Profil mindestens eine **Fachrichtung**, **Spezialisierung**, **Methode**, **Tierart**, plus **`directory_profile_sources`** und **`directory_profile_social_links`** (`website`). Vier Profile haben zusätzlich ein **Logo**-Medium (externer Platzhalter-URL).
- **Annahmen:** Keine produktiven Verzeichnisprofile in derselben Datenbank; die Migration ist **destruktiv** für alle Zeilen in `directory_profiles`.

Details zum Datenmodell: [data-model-specialties-subcategories-methods.md](./data-model-specialties-subcategories-methods.md).

---

## 2. Seed-Daten Tierarten (`directory_animal_types`)

| code | name |
|------|------|
| `pferd` | Pferd |
| `hund` | Hund |
| `katze` | Katze |
| `kleintiere` | Kleintiere |
| `nutztiere` | Nutztiere |

---

## 3. Seed-Strategie

- **Anlage:** SQL-Migration mit `INSERT … ON CONFLICT (code) DO UPDATE` für Name/Sortierung/`is_active` (idempotent, keine doppelten Codes).
- **Erweiterungen:** Neue Codes in **neuer** Migration oder bewusstes Update derselben Seed-Datei mit klarer Versionskette.
- **Import-Aliase** (`lib/directory/import/aliases.ts`) müssen mit den DB-Codes übereinstimmen; bei neuen Codes zuerst Migration, dann Aliase ergänzen.

---

## 4. Feld-Mapping Rohdaten → Schema

| Rohfeld | Ziel |
|---------|------|
| `praxisname` | `directory_profiles.practice_name` |
| `ansprechpartner_name` | bevorzugt `display_name`; falls leer → `praxisname` |
| `fachrichtung` + `unterkategorie` | Auflösung → `directory_profile_specialties` (Codes → UUIDs) |
| `tierarten` | Komma/Pipe-getrennt → `directory_profile_animal_types` |
| `mobil_oder_praxis` | `service_type` (`stationary` / `mobile` / `both`) |
| `strasse`, `hausnummer`, `plz`, `ort`, `bundesland` | Adressfelder |
| `telefon`, `email` | `phone_public`, `email_public` |
| `website` | URL + Eintrag `directory_profile_social_links` (`platform=website`) |
| `beschreibung_kurz` | `short_description` |
| `einsatzgebiet` | `service_area_text` |
| `qualifikationen`, `leistungen` | angehängt an `description` (Abschnitte) |
| `verifiziert_status` | `verification_state` (heuristisch) |
| `profil_status` | nur bei `--allow-published` → `listing_status`; sonst `draft` |
| `premium_status` | `premium_active` (truthy) |
| `quellen_url_*`, `quellen_typ`, `datenqualitaet` | `directory_profile_sources` |
| — | `claim_state` immer `unclaimed`, `country` default `DE`, `data_origin` `import` |

**Nicht aus Rohdaten gesetzt:** `claimed_by_user_id`, Geo, Medien aus `bilder_vorhanden` (MVP).

---

## 5. Normalisierung (Import)

- Strings: trimmen, leer → `NULL`.
- `country`: ISO alpha-2 groß, Default `DE`.
- `mobil_oder_praxis`: deutsche Schlüsselwörter → `stationary` / `mobile` / `both`.
- Fachrichtung/Tierarten: Normalisierung über Alias-Map (Kleinschreibung, Leerzeichen).
- **Slug:** aus `praxisname` + `plz`, slugify; bei Kollision `-2`, `-3`, …
- PLZ/Ort: nur trimmen (kein externes Geocoding im MVP).

---

## 6. Veröffentlichungslogik

- **Standard:** `listing_status = draft` (konservativ).
- **Optional:** `--allow-published` setzt `published`, wenn `profil_status` publish-Synonyme enthält **und** Mindestkriterien erfüllt sind: Anzeigename + (`plz` oder `ort`).
- **Importierte Daten:** fachlich als „gefunden“; „geprüft“/„veröffentlichbar“ über `data_quality` + spätere Redaktion oder separates Admin-Review.

---

## 7. Import-Batch

1. Zeile in `directory_import_batches` (`name`, `source_system=directory_json_import`, `started_at`).
2. Pro Rohzeile: Dubletten-Check über `directory_profile_sources.external_key` (siehe unten).
3. **Neu:** Profil insert, Junctions ersetzen, Quelle insert, Social-Links ersetzen.
4. **Bestehend:** Profil update (ohne Slug-Änderung), Junctions/Social ersetzen, **neue** Quellenzeile (Audit).
5. Batch `completed_at` setzen.

Hinweis: Keine DB-Transaktion über alle Zeilen — bei Fehler mittendrin bleiben vorherige Zeilen gespeichert.

---

## 8. Dubletten (MVP)

`external_key` in `directory_profile_sources`:

1. Normalisierte Website (`web:host/path`), sonst
2. `nameplz:lowercase-name|plz`, sonst
3. normalisierte Telefonnummer (`tel:…`), sonst
4. Fallback-String.

Treffer auf neueste `directory_profile_sources`-Zeile mit gleichem Key → Update desselben Profils.

Später erweiterbar: fuzzy name, zusätzliche externe IDs im Rohformat.

---

## 9. Konkrete Umsetzung im Repo

| Teil | Pfad |
|------|------|
| Seed-Migration | `supabase/migrations/20260406140000_directory_reference_seed.sql` |
| Import-Logik | `lib/directory/import/*` |
| CLI | `scripts/directory/import-from-json.ts` |
| Beispiel-JSON | `scripts/directory/sample-import.json` |

**npm-Script:** `pnpm run directory:import -- scripts/directory/sample-import.json --dry-run`

Voraussetzungen: Referenz-Seeds migriert; `.env.local` mit `SUPABASE_SERVICE_ROLE_KEY` und `NEXT_PUBLIC_SUPABASE_URL`.

---

## 10. Erster Testimport

1. `supabase db push` (oder Migration lokal anwenden), damit Seed + Schema stehen.
2. Trockenlauf:  
   `pnpm run directory:import -- scripts/directory/sample-import.json --dry-run`
3. Echter Lauf:  
   `pnpm run directory:import -- scripts/directory/sample-import.json`
4. Prüfen in Supabase Table Editor: `directory_profiles`, `directory_profile_sources`, Junctions.

Optional: `--allow-published` nur mit vertrauenswürdigen, bereits geprüften Daten.
