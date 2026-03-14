# PROJECT_CONTEXT

## Datenbank / Backend (Ist-Zustand im Repo)

Dieses Projekt nutzt **Supabase** (Postgres + Auth + Storage) über `@supabase/supabase-js` / `@supabase/ssr`.

- **Supabase URL**: aus `NEXT_PUBLIC_SUPABASE_URL` (siehe `.env.local`)
- **Auth**: `supabase.auth.getUser()` wird als Gate genutzt (Redirect nach `/login`, wenn nicht eingeloggt).
- **Schema-Quelle**: Im Repository liegen **keine** SQL-Migrations / kein Prisma-/Drizzle-Schema. Die Struktur lässt sich daher nur **aus den verwendeten Queries/Mutations im Code** ableiten.
- **Multi-Tenancy / Zugriff**: In sehr vielen Queries wird explizit nach `user_id = user.id` gefiltert bzw. beim Insert `user_id` gesetzt. (Row Level Security wird vermutlich serverseitig ergänzt, ist aber im Repo nicht sichtbar.)

## Storage

- **Bucket**: `hoof-photos`
  - Upload: `supabase.storage.from('hoof-photos').upload(filePath, file, { upsert: false })`
  - Delete: `supabase.storage.from('hoof-photos').remove(filePaths)`
  - Signed URLs: `createSignedUrl(filePath, 60 * 60)`

## Tabellen (aus Code-Nutzung abgeleitet)

### `customers`

**Zweck**: Kunden-/Besitzerstammdaten inkl. Rechnungsanschrift, Stalladresse, Terminpräferenzen.

**Primäre Nutzung**:
- Create/Update über `components/customers/CustomerForm.tsx`
- Read in `app/(app)/dashboard/page.tsx`, `app/(app)/calendar/page.tsx`, `app/(app)/customers/[id]/page.tsx`, `app/(app)/horses/[id]/page.tsx`

**Beobachtete Spalten** (Auswahl; nur was im Code vorkommt):
- `id`
- `user_id`
- Name/Kontakt:
  - `name`, `salutation`, `first_name`, `last_name`
  - `phone`, `phone2`, `email`
  - `preferred_contact`
- Rechnungsadresse:
  - `street`, `house_number` (im Code auf `null` gesetzt), `city`, `postal_code`, `country`
  - `company`, `vat_id`
- Stalladresse (optional, wenn `stable_differs`):
  - `stable_differs`
  - `stable_name`, `stable_street`, `stable_city`, `stable_zip`, `stable_country`
  - `stable_contact`, `stable_phone`
  - `drive_time`, `directions`
- Terminpräferenzen:
  - `preferred_days` (Array, im Code: `string[] | null`)
  - `preferred_time`
  - `interval_weeks`
  - `reminder_timing`
- Sonstiges:
  - `notes`, `source`
- `created_at` (wird gelesen)

**Relationen**:
- 1:N zu `horses` über `horses.customer_id`
- 1:N zu `appointments` über `appointments.customer_id`

---

### `horses`

**Zweck**: Pferdeakte / Stammdaten pro Pferd.

**Primäre Nutzung**:
- Create/Update über `components/horses/HorseForm.tsx`
- Listen/Detailseiten: `app/(app)/horses/page.tsx`, `app/(app)/horses/[id]/page.tsx`

**Beobachtete Spalten**:
- `id`
- `user_id`
- `customer_id` (nullable)
- `name`
- `breed`
- `sex`
- `birth_year` (number)
- `birth_date` (date/ISO string; wird beim Insert/Update gesetzt)
- `usage`
- `housing`
- `hoof_status`
- `care_interval`
- `special_notes`
- `notes`

**Relationen**:
- N:1 zu `customers` über `customer_id`
- N:M zu `appointments` über Join-Tabelle `appointment_horses`
- 1:N zu `hoof_records` über `hoof_records.horse_id`

---

### `appointments`

**Zweck**: Terminplanung.

**Primäre Nutzung**:
- Create/Update/Delete über `components/appointments/AppointmentForm.tsx`
- Listen: `app/(app)/dashboard/page.tsx`, `app/(app)/calendar/page.tsx`, `app/(app)/customers/[id]/page.tsx`, `app/(app)/horses/page.tsx`, `app/(app)/horses/[id]/page.tsx`

**Beobachtete Spalten**:
- `id`
- `user_id`
- `customer_id` (nullable)
- `appointment_date` (timestamp/ISO string; wird per `.not('appointment_date', 'is', null)` gefiltert)
- `notes`
- `type`
- `status`
- `duration_minutes` (wird beim Create/Update gesetzt)

**Hinweis (Schema-Inkonsistenz / Altlast möglich)**:
- In `app/(app)/horses/[id]/page.tsx` wird beim Löschen eines Pferds zusätzlich `appointments` über `.eq('horse_id', horseId)` gelöscht. Das deutet auf eine (evtl. ältere) Spalte `horse_id` in `appointments` hin.
- In der restlichen App wird die Pferde-Zuordnung über `appointment_horses` modelliert (N:M). Falls `appointments.horse_id` noch existiert, ist das wahrscheinlich Legacy oder ein optionaler Shortcut.

**Relationen**:
- N:1 zu `customers` über `customer_id`
- N:M zu `horses` über `appointment_horses`

---

### `appointment_horses`

**Zweck**: Join-Tabelle für **N:M** zwischen Terminen und Pferden.

**Primäre Nutzung**:
- Insert/Reset beim Erstellen/Bearbeiten eines Termins (`components/appointments/AppointmentForm.tsx`)
- Read für Kalender/Dashboard/Listen (`app/(app)/dashboard/page.tsx`, `app/(app)/calendar/page.tsx`, `app/(app)/customers/[id]/page.tsx`, `app/(app)/horses/page.tsx`)

**Beobachtete Spalten**:
- `appointment_id`
- `horse_id`
- `user_id`

**Relationen**:
- N:1 zu `appointments` über `appointment_id`
- N:1 zu `horses` über `horse_id`

---

### `hoof_records`

**Zweck**: Huf-Dokumentation/Behandlungsprotokoll pro Pferd.

**Primäre Nutzung**:
- Listen/Counts: `app/(app)/dashboard/page.tsx`, `app/(app)/horses/page.tsx`, `app/(app)/horses/[id]/page.tsx`, `app/(app)/customers/[id]/records/page.tsx`
- Detail/CRUD: `app/(app)/horses/[id]/records/[recordId]/page.tsx`, `app/(app)/horses/[id]/records/[recordId]/edit/page.tsx`

**Beobachtete Spalten**:
- `id`
- `user_id`
- `horse_id`
- `record_date`
- `hoof_condition`
- `treatment`
- `notes`

**Geplante/zusätzliche Felder (UI-Formular legt sie bereits an)**:
In `components/records/RecordCreateForm.tsx` werden für ein Create-Formular Hidden-Felder vorbereitet, u. a.:
- `record_type`, `general_condition`, `gait`, `handling_behavior`, `horn_quality`
- `summary_notes`, `recommendation_notes`
- `checklist_json`, `hoofs_json`

Ob diese Felder tatsächlich **in `hoof_records` persistiert** werden, ist im aktuellen Repo nicht sichtbar (keine Insert-Action gefunden). Falls du ein Server-Action/Route zum Speichern ergänzst, sollten diese Spalten bzw. ein JSONB-Feld im Schema existieren.

**Relationen**:
- N:1 zu `horses` über `horse_id`
- 1:N zu `hoof_photos` über `hoof_photos.hoof_record_id`

---

### `hoof_photos`

**Zweck**: Metadaten zu Fotos, die im Storage-Bucket `hoof-photos` liegen.

**Primäre Nutzung**:
- Insert beim Upload: `app/(app)/horses/[id]/records/[recordId]/photos/new/page.tsx`
- Read/Delete: `app/(app)/horses/[id]/records/[recordId]/page.tsx`, `app/(app)/horses/[id]/page.tsx`

**Beobachtete Spalten**:
- `id`
- `user_id`
- `hoof_record_id` (nullable)
- `file_path` (Storage-Key)
- `photo_type`

**Relationen**:
- N:1 zu `hoof_records` über `hoof_record_id`

## Typische Query-Muster (für Verständnis & spätere RLS)

- **User-Scoping**:
  - Reads: fast überall `.eq('user_id', user.id)`
  - Writes: payload enthält `user_id: user.id` + Updates/Deletes zusätzlich `.eq('user_id', user.id)`
- **Termin-Zeiträume**:
  - Kalender/Dashboard nutzen `.not('appointment_date', 'is', null)`, `.gte(...)`, `.lt(...)`, `.order('appointment_date')`.
- **Join-Reads**:
  - `appointments` werden häufig mit eingebetteten `customers (...)` selektiert.
  - Pferde je Termin werden über `appointment_horses` + eingebettete `horses (...)` geladen.

## Offene Punkte / Was im Repo fehlt

- **Keine Migrationen im Repo**: Wenn du zukünftig das Schema versionieren willst, bietet sich Supabase-Migrations (`supabase/migrations/*.sql`) oder ein ORM (Prisma/Drizzle) an.
- **Keine generierten Supabase Types**: Es gibt keine `Database`-Typdefinitionen (z. B. `database.types.ts`). Dadurch bleiben Spalten/Nullability im Code teils “nur implizit”.

