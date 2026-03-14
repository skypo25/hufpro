# Kontext & Architektur (Hufpflege-App)

## Produktziel (Domain)

Die App ist für **Hufbearbeiter** gedacht und soll:

- **Kunden** verwalten (Kontakt, Rechnungs-/Stalladresse, Präferenzen)
- **Pferde** verwalten (Stammdaten, Hufstatus, Notizen)
- **Termine** planen (inkl. Zuordnung mehrerer Pferde)
- **Huf-Behandlungen / Dokumentationen** erfassen (Befund + Maßnahmen + Empfehlung + Checkliste)
- **Fotodokumentation** pro Behandlung speichern und anzeigen (Supabase Storage + DB-Metadaten)

## Tech-Stack (Ist-Zustand)

- **Frontend**: Next.js **App Router** (`app/`), React 19
- **Backend**: Supabase (Postgres + Auth + Storage)
- **Supabase Clients**
  - **Server**: `createSupabaseServerClient()` (`lib/supabase-server.ts`, `@supabase/ssr`) – nutzt Cookies
  - **Browser**: `supabase` (`lib/supabase-client.ts`, `@supabase/ssr`) – für Client-Komponenten/Forms
  - Zusätzlich vorhanden: `lib/supabase.ts` (`@supabase/supabase-js`) – wird u. a. noch in `app/page.tsx` und `app/(app)/suche/page.tsx` genutzt (Legacy/Inkonsistenz, siehe Hinweise).

## Auth / Zugriff (Flow)

- **Middleware-Gate** (`middleware.ts`)
  - schützt `/dashboard`, `/customers`, `/horses`, `/calendar`, `/suche`
  - leitet ohne Login nach `/login` um
  - leitet eingeloggte Nutzer von `/login` nach `/dashboard` um
- **Zusätzlich** prüfen viele Server-Seiten `supabase.auth.getUser()` und rufen `redirect('/login')` auf.
- **Datenzugriff**: Fast überall wird mit `user_id = user.id` gescoped (Reads + Writes).

## App-Struktur (App Router)

### Routen (Auswahl, “Kernstrecke”)

- **Auth**
  - `app/(auth)/login/page.tsx` (Client-Seite; Login + Register über Supabase Auth)
- **Dashboard**
  - `app/(app)/dashboard/page.tsx` (Server; lädt KPIs + “heutige Termine”)
- **Kunden**
  - `app/(app)/customers/page.tsx` (Server; Liste + Filter/Sort via `searchParams`)
  - `app/(app)/customers/new/page.tsx` (Server; lädt Context und rendert `CustomerForm`)
  - `app/(app)/customers/[id]/page.tsx` (Server; Detail inkl. Pferde + Termine)
  - `app/(app)/customers/[id]/edit/page.tsx` (Server; Detaildaten -> `CustomerForm`)
  - `app/(app)/customers/[id]/records/page.tsx` (Server; alle `hoof_records` über alle Pferde eines Kunden)
- **Pferde**
  - `app/(app)/horses/page.tsx` (Server; Liste + KPI; berechnet “nächster Termin” über Join-Tabelle)
  - `app/(app)/horses/new/page.tsx` (Server; lädt Kundenliste -> `HorseForm`)
  - `app/(app)/horses/[id]/page.tsx` (Server; Pferdeakte + Records + Fotoanzahl + Delete-Flow)
  - `app/(app)/horses/[id]/edit/page.tsx` (Server; Detaildaten -> `HorseForm`)
- **Termine**
  - `app/(app)/calendar/page.tsx` (Client; lädt Termine via `useEffect` + Supabase Browser Client)
  - `app/(app)/appointments/new/page.tsx` (Server; lädt Customers/Horses + Tagesliste -> `AppointmentForm`)
  - `app/(app)/appointments/[id]/edit/page.tsx` (Server; lädt Appointment + Links -> `AppointmentForm`)
- **Dokumentation / Fotos**
  - `app/(app)/horses/[id]/records/[recordId]/page.tsx` (Server; Record-Detail + Fotos)
  - `app/(app)/horses/[id]/records/[recordId]/edit/page.tsx` (Server; Update von `hoof_records`)
  - `app/(app)/horses/[id]/records/[recordId]/photos/new/page.tsx` (Client; Upload -> Storage + Insert `hoof_photos`)
  - `app/(app)/horses/[id]/records/new/page.tsx` (Client; enthält aktuell hauptsächlich UI für Record-Erfassung – Persistierung fehlt/ist nicht angeschlossen)

## Supabase-Schema (aus API-Aufrufen in `/lib`, `app/`, `components/`)

### Tabellen, die bereits angesprochen werden

- `customers`
- `horses`
- `appointments`
- `appointment_horses` (Join-Tabelle für N:M zwischen Termin und Pferden)
- `hoof_records`
- `hoof_photos`

### Storage

- Bucket: `hoof-photos`
  - Upload/Remove/Signed URLs werden aktiv genutzt.

### Wichtige Felder/Relationen (aus Code abgeleitet)

- **Tenant-Scope**: `user_id` ist durchgängig im Einsatz (Filter + Insert)
- **Kunde -> Pferde**: `horses.customer_id`
- **Kunde -> Termine**: `appointments.customer_id`
- **Termin <-> Pferd (N:M)**: `appointment_horses(appointment_id, horse_id, user_id)`
- **Pferd -> Dokumentationen**: `hoof_records.horse_id`
- **Dokumentation -> Fotos**: `hoof_photos.hoof_record_id` + `file_path` (Key im Storage)

### Hinweis: Inkonsistenzen/Legacy im Terminmodell

Im Projekt existieren **zwei** Termin-Implementierungen:

- **Neu/primär**: `components/appointments/AppointmentForm.tsx` + `appointments` enthält u. a. `type`, `status`, `duration_minutes`; Pferde hängen über `appointment_horses`.
- **Alt/zusätzlich vorhanden**: `app/(app)/appointments/new/form.tsx` nutzt `appointments.horse_id` (lead horse) **und** `appointment_horses`.
  - Das deutet darauf hin, dass `appointments.horse_id` (optional) noch existiert oder früher existierte.

## Frontend-Architektur & State-Management (Ist-Zustand)

### Grundprinzip

Es gibt aktuell **kein globales State-Management** (kein Redux/Zustand/Jotai). Der State-Flow ist überwiegend:

- **Server Components** laden Daten (Supabase Server Client) und übergeben sie als Props an UI-Komponenten.
- **Client Components** verwalten UI-State lokal mit `useState`, derive mit `useMemo`, und laden bei Bedarf Daten mit `useEffect`.
- Nach Writes wird häufig `router.push(...)` + `router.refresh()` genutzt, um den Server-Tree zu aktualisieren.

### Typische Datenflüsse

- **Listen-Seiten (Server)**: Filtern/Sortieren über `searchParams` (`/customers`, `/horses`) → serverseitige Datenabfrage → Rendering.
- **Formulare (Client)**: lokale Inputs + Submit → Supabase Browser Client (`insert/update/delete`) → Navigation + Refresh.
- **Kalender (Client)**: `useEffect()` → `supabase.from('appointments')...` → State `appointments` → Rendering (Komponente `WeekCalendar`).

### Auth im UI

- `LoginPage` nutzt Browser Client (`supabase.auth.signInWithPassword`, `signUp`)
- Protected Pages sind zusätzlich über Middleware abgesichert.

## Kern-Komponenten in `/components` (für die Hufpflege-App relevant)

### Navigation / Layout

- `components/Sidebar.tsx` (App-Navigation)
- `components/Topbar.tsx` (einfacher Header)
- `components/LogoutButton.tsx`

### Kunden

- `components/customers/CustomerForm.tsx`
- `components/customers/customerFormDefaults.ts`

### Pferde

- `components/horses/HorseForm.tsx`
- `components/horses/horseFormDefaults.ts`

### Termine

- `components/appointments/AppointmentForm.tsx` (Create/Edit, inkl. Pferde-Zuordnung)
- Picker/UX:
  - `components/appointments/CustomerPicker.tsx`
  - `components/appointments/HorsePicker.tsx`
  - `components/appointments/AppointmentTypePicker.tsx`
  - `components/appointments/AppointmentSidebar.tsx`
- Kalender:
  - `components/appointments/calendar/WeekCalendar.tsx`
- Typen:
  - `components/appointments/types.ts`

### Dokumentation

- `components/records/RecordCreateForm.tsx` (UI für Befund/Checkliste/Textbausteine; speichert derzeit über `saveAction` – Anschluss im Routing fehlt)

### UI-Bausteine (häufig genutzt)

- `components/ui/PageHeader.tsx`, `components/ui/StatCard.tsx`, `components/ui/EmptyState.tsx`
- `components/ui/ActionButton.tsx`
- Card/Section Komponenten (`components/ui/card/*`, `components/ui/SectionCard.tsx`, `components/ui/InfoItem.tsx`, `components/ui/TableEmptyRow.tsx`, `components/ui/Breadcrumbs.tsx`)

> Hinweis: Es existieren zusätzlich viele “template-artige” Komponentenordner (`components/ecommerce`, `components/form`, `components/auth`, `components/header`, …). Ein Teil davon wirkt aktuell **nicht** in den Hufpflege-Flows eingebunden.

## Nächste logische Schritte: Huf-Dokumentation vervollständigen

### 1) “Record Create” wirklich persistieren

Aktuell gibt es eine sehr umfangreiche UI für die Erfassung (`RecordCreateForm`), aber:

- In `app/(app)/horses/[id]/records/new/page.tsx` ist **kein** sauberer Server-Load + Save-Flow angeschlossen.
- Es fehlt die **Create-Action**, die in Supabase schreibt.

Empfehlung:

- Eine Server-seitige Action/Route einführen, die:
  - `hoof_records` anlegt (mindestens: `user_id`, `horse_id`, `record_date`, ggf. `record_type`, `summary_notes`, `recommendation_notes`, …)
  - die “per-hoof”-Daten persistiert:
    - entweder als JSONB-Feld in `hoof_records` (z. B. `hoofs_json`, `checklist_json`)
    - oder als normalisierte Tabelle (z. B. `hoof_record_hoofs` mit `hoof_record_id`, `hoof_position`, `angle_deg`, …)

### 2) Datenmodell für Textbausteine finalisieren

Die UI ist auf “TextBlocks” ausgelegt (`category`, `label`, `sort_order`, `is_system`, `user_id`), aber im Code werden aktuell **keine** `record_text_blocks` geladen.

Empfehlung:

- Eine Tabelle (z. B. `record_text_blocks`) in Supabase definieren + CRUD-Flow ergänzen (mindestens Read).

### 3) Foto-Workflow zur Dokumentation “end-to-end”

Du hast bereits:

- Storage Upload + Metadaten-Insert (`hoof_photos`)
- Anzeige + Signed URL im Record-Detail

Fehlt für “vollständig”:

- In der Dokumentations-Erstellung echte **Foto-Slots** (VL/VR/HL/HR + ggf. Ganzkörper beim Ersttermin)
- Optional: “Fotoarten”/Tags standardisieren (`photo_type`) und ggf. `hoof_position` ergänzen, um Fotos sauber zuzuordnen.
- Optional: Vergleich/Verlauf (z. B. “letztes Sohlenfoto vs. aktuelles”)

### 4) Konsolidierung der Termin-Implementierungen

Damit die Datenbankstruktur klar bleibt:

- `app/(app)/appointments/*/form.tsx` wirkt wie eine ältere Implementierung (mit `appointments.horse_id`).
- Die App nutzt sonst `appointment_horses` als Standard.

Empfehlung:

- Altes Formular entfernen oder auf das neue Modell migrieren, damit “eine Wahrheit” existiert.

### 5) Typing & Schema-Transparenz

Für weniger Schema-Drift:

- Supabase DB Types generieren (z. B. `database.types.ts`) und im Code verwenden.
- Optional: Schema/Migrations in-repo versionieren (Supabase migrations oder ORM).

## Bekannte Auffälligkeit (schnell fixbar)

- `app/(app)/suche/page.tsx` nutzt `lib/supabase` (Anon Client) direkt in einer Server Component und filtert **nicht** nach `user_id`.
  - Das bricht das sonstige Sicherheits-/Tenant-Modell und kann (je nach RLS) entweder fehlschlagen oder fremde Daten sichtbar machen.

