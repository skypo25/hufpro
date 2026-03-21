# Code-Audit: Sicherheit, Stabilität & Performance

**Projekt:** Hufpflege-App (AniDocs)  
**Datum der Analyse:** März 2025  
**Hinweis:** Reine Analyse – keine Codeänderungen vorgenommen.

---

# 1. Sicherheitsprüfung

## Kritisch

| Thema | Beschreibung | Ort |
|-------|-------------|-----|
| *(Keine kritischen Sicherheitslücken identifiziert)* | Auth und user_id-Scoping sind in den geprüften API-Routen durchgängig umgesetzt. | – |

## Mittel

| Thema | Beschreibung | Ort |
|-------|-------------|-----|
| **Storage hoof-photos INSERT Policy** | Die RLS-Policy erlaubt INSERT für `authenticated` und `anon`. Bei aktivem anonymen Zugriff könnte theoretisch unautorisiert hochgeladen werden. SELECT/UPDATE/DELETE erfordern `owner_id = auth.uid()`. | `supabase/migrations/20250316000001_storage_hoof_photos_rls.sql` (9–12) |
| **Settings API – beliebige Keys** | Der Request-Body wird ohne Allowlist in `user_settings` geschrieben. Beliebige Schlüssel können gespeichert werden, z. B. `smtpPassword` oder andere sensible Felder. | `app/api/settings/route.ts` (18–33) |
| **Fehlende React Error Boundaries** | Kein `error.tsx` und keine `ErrorBoundary`-Komponenten. Unbehandelte Fehler können zu weißen Bildschirmen führen. | Projektweit (kein Treffer für `error.tsx` oder `ErrorBoundary`) |

## Niedrig

| Thema | Beschreibung | Ort |
|-------|-------------|-----|
| **Search API – LIKE-Wildcards** | `searchQuery` wird direkt in `.ilike()` verwendet. `%` und `_` wirken als SQL-Wildcards und können unerwünscht breitere Suchergebnisse liefern. | `app/api/search/route.ts` (51, 65–66, 82) |
| **Keine schema-basierte Validierung** | API-Bodies werden ad-hoc geprüft (z. B. `typeof x === 'string'`). Kein Zod, Yup o. Ä. – erhöht Risiko für unerwartete Eingaben. | Diverse API-Routen |
| **PDF-Dateinamen** | Der Filename enthält dynamische Daten (`data.horse.name`, `data.record.recordDate`). Bei Sonderzeichen könnten Download-Probleme entstehen. | `app/(app)/horses/[id]/records/[recordId]/pdf/route.ts` (48) |
| **Link zu /datenschutz** | Auf der Registrierungsseite verlinkt, Route existiert nicht → 404. | `app/(auth)/register/page.tsx` (123) |

## Hinweise

| Thema | Beschreibung | Ort |
|-------|-------------|-----|
| **API-Routen außerhalb Middleware** | Der Matcher schließt `/api/*` aus. Jede API-Route muss Auth selbst prüfen. Bisherige Prüfung: konsistent. | `middleware.ts` (84–99) |
| **Supabase Service Role** | Wird nur für `appointments/confirm` und `termin-bestaetigen` genutzt – tokenbasiert, bewusst ohne User-Auth. | `lib/supabase-service.ts` |
| **Umgebungsvariablen** | `.env*` in `.gitignore`. Keine hardcodierten Secrets gefunden. `SUPABASE_SERVICE_ROLE_KEY` und `OPENAI_API_KEY` nur serverseitig. | Projektroot |
| **PDF-Routen** | `/invoices/[id]/pdf` und `/horses/[id]/records/[recordId]/pdf` prüfen Auth und `user_id` über `fetchInvoicePdfData`/`fetchRecordPdfData`. | `app/(app)/invoices/[id]/pdf/route.ts`, `app/(app)/horses/[id]/records/[recordId]/pdf/route.ts` |
| **Bild-Upload** | Clientseitig über Supabase Storage; Content-Type `image/jpeg`. Keine serverseitige Validierung von MIME/Size. Bucket `user-logos` hat explizite Limits. | `components/photos/usePhotoUpload.ts` (48–54) |

---

# 2. Fehlerprüfung / Stabilität

## Kritisch

| Thema | Beschreibung | Ort |
|-------|-------------|-----|
| **PDF-Download in PWA funktioniert nicht** | `MobileRecordDetail` ruft `/api/pdf/record/${recordId}` auf. Diese Route existiert nicht (404). Die eigentliche Route ist `/horses/${horseId}/records/${recordId}/pdf`. | `components/mobile/MobileRecordDetail.tsx` (432) |

## Mittel

| Thema | Beschreibung | Ort |
|-------|-------------|-----|
| **Keine Error Boundaries** | React-Fehler werden nicht gefangen. Unbehandelte Exceptions führen zu weißen Bildschirmen statt strukturierter Fehleranzeige. | Projektweit |
| **TypeScript Build-Fehler ignoriert** | `typescript: { ignoreBuildErrors: true }` in `next.config.ts` – TS-Fehler werden beim Build ignoriert. Erhöht Risiko für Laufzeitfehler. | `next.config.ts` (6) |
| **useOfflineDraft – mögliche veraltete Closures** | `load` hängt von `key` ab; bei Wechsel von create zu edit könnte ein veralteter Draft geladen werden. | `hooks/useOfflineDraft.ts` (33–46) |

## Niedrig

| Thema | Beschreibung | Ort |
|-------|-------------|-----|
| **Offline-Sync – kein Konflikt-Handling** | Keine dokumentierte Strategie für Konflikte bei gleichzeitigem Bearbeiten. Last-write-wins implizit. | `hooks/useOfflineDraft.ts`, `DOCS/PWA-OFFLINE.md` |
| **Offline-Save-Fehler nur console.warn** | Fehlgeschlagene Persistierung wird nur geloggt, keine Benutzer-Retry oder Fehlermeldung. | `hooks/useOfflineDraft.ts` (61) |
| **Debounce-Cleanup bei Unmount** | Timeout wird in `useEffect`-Return gelöscht; bei sehr knappem Timing könnte ein Pending-Debounce nach Unmount feuern. | `hooks/useOfflineDraft.ts` (94–96) |
| **Formulare – State-Handling** | Viele lokale `useState`; bei großen Formularen (z. B. RecordCreateForm, MobileRecordForm) potenzielle Race-Conditions bei schnellen Benutzeraktionen. | `components/records/RecordCreateForm.tsx`, `components/mobile/MobileRecordForm.tsx` |

## Hinweise

| Thema | Beschreibung | Ort |
|-------|-------------|-----|
| **Mobile vs. Desktop** | PWA nutzt `mobileRouteMap` mit Regex. Abweichungen zwischen Desktop- und PWA-Routen könnten zu Inkonsistenzen führen. | `components/mobile/mobileRouteMap.tsx` |
| **Routing mit dynamischen Params** | `[id]`, `[recordId]`, `[token]` werden korrekt verwendet. | Diverse `app/`-Routen |
| **Async-Prozesse** | API-Routen nutzen try/catch und strukturierte Fehlerantworten. | API-Routen |

---

# 3. Performance-Potenziale

## Schnell umsetzbar

| Maßnahme | Beschreibung | Betroffener Bereich |
|----------|-------------|---------------------|
| **PDF-Route in MobileRecordDetail korrigieren** | URL von `/api/pdf/record/${recordId}` auf `/horses/${horseId}/records/${recordId}/pdf` ändern. Behebt 404, keine Performance-Änderung. | `components/mobile/MobileRecordDetail.tsx` (432) |
| **React.memo für Listen-Items** | Für häufig gerenderte Listen (z. B. Pferde, Kunden, Terminkarten) `React.memo` verwenden, um unnötige Re-Renders zu reduzieren. | z. B. `MobileHorses.tsx`, `MobileCustomers.tsx`, `MobileCalendar.tsx` |
| **`loading="lazy"` für Bilder** | Bei Photo-Grids und großen Bildlisten Lazy-Loading nutzen. | `components/photos/PhotoGrid.tsx` |
| **Caching von Kalender-/Listen-Daten** | Für Kalender- und Listen-APIs `revalidate` oder SWR/React Query nutzen, um Doppel-Requests zu vermeiden. | `app/api/calendar/mobile/route.ts`, `app/api/horses/mobile/route.ts` |

## Mittel

| Maßnahme | Beschreibung | Betroffener Bereich |
|----------|-------------|---------------------|
| **RecordCreateForm aufteilen** | ~1500 Zeilen, viele Zustände. Aufteilung in Unterkomponenten (z. B. HoofCard, PhotoSection) verbessert Wartbarkeit und ermöglicht gezielteres Memoizing. | `components/records/RecordCreateForm.tsx` |
| **MobileRecordForm modularisieren** | Ähnlich groß. Sections als eigene Komponenten mit `React.memo`. | `components/mobile/MobileRecordForm.tsx` |
| **Dynamisches Import von @react-pdf** | `@react-pdf/renderer` nur bei PDF-Erzeugung laden. Ist bereits `serverExternalPackages` – prüfen, ob clientseitige Imports vermieden werden. | `next.config.ts`, PDF-Komponenten |
| **Bilder in PDFs – Signed URLs cachen** | `recordData.ts` lädt Bilder per `createSignedUrl` und fetch. Kurze Cache-Zeit (5 Min). Bei vielen Bildern pro PDF könnten parallele Fetches gebündelt werden. | `lib/pdf/recordData.ts` (47–62) |
| **Offline-Draft – Base64-Größe begrenzen** | `MAX_BASE64_SIZE` 800 KB pro Bild; bis zu 4 Bilder. IndexedDB kann bei vielen Entwürfen wachsen. Evtl. ältere Entwürfe bereinigen oder Kompression anpassen. | `lib/record-draft-serializer.ts` (22–23) |

## Später sinnvoll

| Maßnahme | Beschreibung | Betroffener Bereich |
|----------|-------------|---------------------|
| **Next.js App Router – Route Segments** | Wichtige Routen als eigene Segments mit `loading.tsx` versehen für bessere Loading-States. | `app/(app)/` Struktur |
| **Bundle-Analyse** | `@next/bundle-analyzer` oder ähnlich nutzen, um große Dependencies (FontAwesome, FullCalendar, @react-pdf) und Code-Splitting-Potenzial zu prüfen. | `package.json` |
| **FontAwesome Tree-Shaking** | Nur benötigte Icons importieren, nicht das gesamte Icon-Set. | `@fortawesome/free-solid-svg-icons` |
| **Infrastructure / CDN für Bilder** | Supabase Storage für Hoof-Photos. Evtl. Supabase Image Transformation oder externes CDN für responsive Bildgrößen. | `components/photos/`, Storage |
| **Service Worker – Caching-Strategie** | Serwist/PWA konfigurieren. Cache-Strategie für API-Responses und statische Assets überprüfen. | `next.config.ts`, Serwist |
| **Virtualisierung für lange Listen** | Bei vielen Pferden/Kunden evtl. `react-window` oder `@tanstack/react-virtual` für virtuelle Listen. | `MobileHorses.tsx`, `MobileCustomers.tsx` |

## Hinweise

| Thema | Beschreibung | Ort |
|-------|-------------|-----|
| **useMemo/useCallback** | Bereits in vielen Komponenten verwendet. `React.memo` für Kindkomponenten seltener. | Diverse `components/` |
| **FullCalendar** | Wird auf Desktop-Kalender genutzt. Prüfen, ob für PWA eine schlankere Alternative sinnvoll ist. | `components/appointments/calendar/` |
| **Mobile Performance** | PWA nutzt Bottom-Sheets, modale Panels. Animationen und Overlays können auf schwächeren Geräten ruckeln. | `components/mobile/` |

---

# 4. Zusammenfassung

## Sicherheit
- **Stärken:** Durchgängige Auth-Prüfung in API-Routen, user_id-Scoping, RLS auf Kern-Tabellen, PDF-Routen geschützt.
- **Schwächen:** Settings API erlaubt beliebige Keys; hoof-photos INSERT für anon; kein strukturiertes Input-Validierungsschema.

## Stabilität
- **Stärken:** API-Fehlerbehandlung vorhanden, Offline-Logik dokumentiert, Routing im Großen und Ganzen konsistent.
- **Schwächen:** Fehlender PDF-Link in PWA, keine Error Boundaries, TypeScript-Build-Fehler ignoriert.

## Performance
- **Stärken:** useMemo/useCallback genutzt, Bilder komprimiert, @react-pdf external.
- **Potenziale:** Code-Splitting bei großen Formularen, React.memo, Lazy Loading, Caching für Listen/Kalender.

---

*Bericht Ende – keine Codeänderungen vorgenommen.*
