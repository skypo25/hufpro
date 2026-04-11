# API-Sicherheitsinventar (S4a)

Stand: Inventarisierung nur — **keine** Code-Härtung in diesem Schritt.  
Quelle: alle Handler unter `app/api/**/route.ts` (manuell an Code geprüft).

## Legende

| Spalte | Bedeutung |
|--------|-----------|
| **Öffentlich** | Kein gültiger Login erforderlich; Schutz über Signatur, Secret, Token o. Ä. |
| **Geschützt** | Session/Cookie-Auth (`createSupabaseServerClient` + typisch `getUser()`). |
| **Auth** | Wird vor der Geschäftslogik geprüft? (`ja` / `nein` / `teilweise`) |
| **Ownership/Rolle** | Werden Ressourcen dem User zugeordnet (z. B. `user_id`), Admin, oder fachlicher Check? |
| **Service Role** | Wird `createSupabaseServiceRoleClient()` o. ä. genutzt? |
| **Sonderfall** | Webhook, Cron, KI, öffentlicher Link, … |
| **Priorität** | Geschätztes Risiko **falls** Auth/Checks fehlen oder Secrets kompromittiert sind. |
| **Unsicher** | Nur wo aus dem Route-Code allein keine endgültige Aussage möglich ist (z. B. Abhängigkeit von RLS). |

**Hinweis:** Viele Routen verlassen sich zusätzlich auf **Supabase RLS**. Dieses Dokument bewertet primär die **Route-Handler-Logik**; eine RLS-Audit ist **nicht** Teil von S4a.

---

## Vollständige Matrix

### Auth & Passwort

| Pfad | Methoden | Öffentlich / Geschützt | Auth | Ownership/Rolle | Service Role | Sonderfall | Priorität | Anmerkung |
|------|----------|------------------------|------|-------------------|--------------|------------|-----------|-----------|
| `/api/auth/password-reset/request` | POST | Öffentlich | nein (absichtlich) | E-Mail → User per Admin-API | ja | Anti-Enumeration (`ok: true`) | **Hoch** | Rate-Limit/Abuse außerhalb dieser Route prüfen. |
| `/api/auth/password-reset/confirm` | POST | Öffentlich | nein | Token-Hash in DB, Ablauf | ja | Passwort setzen | **Hoch** | Kompromittierung von `password_reset_tokens` = Account-Takeover. |

### Stripe & Billing

| Pfad | Methoden | Öffentlich / Geschützt | Auth | Ownership/Rolle | Service Role | Sonderfall | Priorität | Anmerkung |
|------|----------|------------------------|------|-------------------|--------------|------------|-----------|-----------|
| `/api/stripe/webhook` | POST | Öffentlich (Stripe) | nein (Signatur) | Event → User über `billing_accounts` / Metadaten | ja | **Webhook** | **Kritisch** | Nur `stripe-signature` + `STRIPE_WEBHOOK_SECRET`. **Nicht** per Session-Middleware „absichern“. |
| `/api/stripe/checkout` | POST | Geschützt | ja | `user_id` für Billing-Zeile | ja | Billing | Mittel | |
| `/api/stripe/portal` | POST | Geschützt | ja | Billing-Zeile zu `user.id` | ja | Billing | Mittel | |
| `/api/stripe/setup-intent/prepare` | POST | Geschützt | ja | Billing-Zeile zu `user.id` | ja | Billing | Mittel | |
| `/api/stripe/subscription/prepare` | POST | Geschützt | ja | Billing-Zeile zu `user.id` | ja | Billing | Mittel | |
| `/api/stripe/subscription/create` | POST | Geschützt | ja | Billing-Zeile zu `user.id` | ja | Billing | Mittel | |
| `/api/stripe/payment-method/set-default` | POST | Geschützt | ja | Billing-Zeile zu `user.id` | ja | Billing | Mittel | |
| `/api/stripe/directory/top-profile/checkout` | POST | Geschützt | ja | Checkout-Metadaten / Profil-Zuordnung | ja | Directory + Billing | Mittel | |
| `/api/billing/account` | GET | Geschützt | ja | nur eigene Daten (User-Session) | nein | Billing | Niedrig | |
| `/api/billing/invoices` | GET | Geschützt | ja | Billing-Zeile per Service, aber `user.id` | ja | Stripe-Liste | Niedrig | |
| `/api/billing/payment-method` | GET | Geschützt | ja | wie oben | ja | Stripe PM | Niedrig | |

### Cron (geheimer Bearer)

| Pfad | Methoden | Öffentlich / Geschützt | Auth | Ownership/Rolle | Service Role | Sonderfall | Priorität | Anmerkung |
|------|----------|------------------------|------|-------------------|--------------|------------|-----------|-----------|
| `/api/cron/appointment-reminders` | GET | Secret (`Bearer CRON_SECRET`) | Secret | — | ja | **Cron**, E-Mail | **Kritisch** | Bei fehlendem/weak Secret: Massenversand. |
| `/api/cron/data-export-cleanup` | GET | Secret | Secret | — | ja (via `cleanupExpiredDataExports`) | **Cron**, Storage | **Kritisch** | Löscht Storage + DB-Zeilen mit Service Role. |
| `/api/cron/data-export-jobs` | GET | Secret | Secret | — | ja (via `processOldestPendingDataExportJob` / Lib) | **Cron**, Export-Jobs | **Kritisch** | Verarbeitet Export-Jobs serverseitig. |

### Terminbestätigung (öffentlicher Link)

| Pfad | Methoden | Öffentlich / Geschützt | Auth | Ownership/Rolle | Service Role | Sonderfall | Priorität | Anmerkung |
|------|----------|------------------------|------|-------------------|--------------|------------|-----------|-----------|
| `/api/appointments/confirm` | GET, POST | Öffentlich (Token) | nein | `confirmation_token` + Ablauf + Status | ja | Öffentlicher Link | **Hoch** | POST ändert Terminstatus; Schutz = Token-Geheimnis + Ablauf. |

### Export

| Pfad | Methoden | Öffentlich / Geschützt | Auth | Ownership/Rolle | Service Role | Sonderfall | Priorität | Anmerkung |
|------|----------|------------------------|------|-------------------|--------------|------------|-----------|-----------|
| `/api/export/email-download` | GET | Öffentlich (signiert) | nein | Signatur `j,u,e,s` + `user_id`-Match Job | ja | **Download-Link aus E-Mail** | **Hoch** | Abhängig von `DATA_EXPORT_DOWNLOAD_SECRET`. |
| `/api/export/full` | GET | Geschützt | ja | `requireExportAccess` (Billing) | nein | ZIP-Download | Mittel | |
| `/api/export/jobs` | GET, POST | Geschützt | ja | `requireExportAccess` + `user_id` | nein | Async Export | Mittel | |
| `/api/export/jobs/[id]` | GET | Geschützt | ja | explizit `row.user_id === user.id` | ja | Signierte Storage-URL | Mittel | Erst DB mit User-Session, dann Service für Signed URL. |

### E-Mail

| Pfad | Methoden | Öffentlich / Geschützt | Auth | Ownership/Rolle | Service Role | Sonderfall | Priorität | Anmerkung |
|------|----------|------------------------|------|-------------------|--------------|------------|-----------|-----------|
| `/api/email/send` | POST | Geschützt | ja | nur `test: true`, Empfänger serverseitig | nein | SMTP-Test | Mittel | Kein freies Relay (Stand S1). |
| `/api/email/appointment-confirmed` | POST | Geschützt | ja | Termin `user_id` | nein | Versand an Kunde | Mittel | |
| `/api/email/appointment-proposed` | POST | Geschützt | ja | Termin `user_id` | nein | Vorschlag + Token-Link | Mittel | |

### KI

| Pfad | Methoden | Öffentlich / Geschützt | Auth | Ownership/Rolle | Service Role | Sonderfall | Priorität | Anmerkung |
|------|----------|------------------------|------|-------------------|--------------|------------|-----------|-----------|
| `/api/ai/improve-text` | POST | Geschützt | ja | — (nur „eingeloggt“) | nein | Externe API | **Hoch** | Kosten-/Abuse-Risiko ohne Rate-Limit/Quota. |
| `/api/ai/format-documentation` | POST | Geschützt | ja | — | nein | Externe API | **Hoch** | wie oben |
| `/api/ai/transcribe` | POST | Geschützt | ja | — | nein | Externe API / Audio | **Hoch** | wie oben + ggf. größere Payloads |

### Mobile / Dashboard / Suche (Session + `user_id`)

| Pfad | Methoden | Öffentlich / Geschützt | Auth | Ownership/Rolle | Service Role | Sonderfall | Priorität | Anmerkung |
|------|----------|------------------------|------|-------------------|--------------|------------|-----------|-----------|
| `/api/dashboard/mobile` | GET | Geschützt | ja | Queries mit `user.id` | nein | Aggregiert viele Daten | Niedrig–Mittel | Umfangreich; RLS als zweite Linie — **Unsicher** ohne RLS-Review. |
| `/api/dashboard/revenue` | GET | **teilweise** | **teilweise** | bei User: `user_id` | nein | — | **Mittel** | **Ohne User:** `200` mit leeren Nullen — kein 401 (informationsarm, aber inkonsistent). |
| `/api/calendar/mobile` | GET | Geschützt | ja | `appointments.user_id` | nein | Kalenderwoche | Niedrig | |
| `/api/appointments/today-count` | GET | Geschützt | ja | `user_id` | nein | — | Niedrig | |
| `/api/appointments/[id]/mobile` | GET | Geschützt | ja | Termin `user_id` | nein | — | Niedrig | |
| `/api/customers/mobile` | GET | Geschützt | ja | `user_id` auf customers/horses | nein | Liste/Suche | Niedrig | |
| `/api/customers/[id]/mobile` | GET | Geschützt | ja | Kunde `user_id` | nein | Detail | Niedrig | |
| `/api/customers/[id]/horses` | GET | Geschützt | ja | Pferde `user_id` + `customer_id` | nein | — | Niedrig | |
| `/api/horses/mobile` | GET | Geschützt | ja | `user_id` | nein | — | Niedrig | |
| `/api/horses/[id]/mobile` | GET | Geschützt | ja | Pferd `user_id` | nein | — | Niedrig | |
| `/api/horses/[id]/delete` | GET, DELETE | Geschützt | ja | Löschpfad mit `user_id` | nein | Destruktiv | Mittel | |
| `/api/horses/[id]/records/[recordId]/mobile` | GET | Geschützt | ja | Pferd `user_id` + Record-Ladung | nein | — | Niedrig | |
| `/api/horses/[id]/hoof-compare` | GET | Geschützt | ja | `loadHorseHoofComparePageData` → unauthorized/forbidden | nein | Cache pro User | Niedrig | |
| `/api/search` | GET | Geschützt | ja | alle Teilabfragen `user_id` | nein | Volltext | Niedrig | |

### Rechnungen & Einstellungen

| Pfad | Methoden | Öffentlich / Geschützt | Auth | Ownership/Rolle | Service Role | Sonderfall | Priorität | Anmerkung |
|------|----------|------------------------|------|-------------------|--------------|------------|-----------|-----------|
| `/api/invoices/[id]/send-email` | POST | Geschützt | ja | Rechnung + Kunde `user_id` | nein | PDF + SMTP | Mittel | Empfänger = Kunden-E-Mail (nicht frei wählbar). |
| `/api/invoices/test` | POST | Geschützt | ja | Kunde `user_id` | nein | Test-Rechnung | Mittel | Legt echte Testdaten an — in Prod Missbrauch möglich (DoS/Spam DB). |

### Sonstige geschützte Hilfs-APIs

| Pfad | Methoden | Öffentlich / Geschützt | Auth | Ownership/Rolle | Service Role | Sonderfall | Priorität | Anmerkung |
|------|----------|------------------------|------|-------------------|--------------|------------|-----------|-----------|
| `/api/settings` | POST | Geschützt | ja | Upsert nur `user_id` | nein | Allowlist Keys | Niedrig | |
| `/api/route-distance` | GET | Geschützt | ja | — (nur eingeloggt) | nein | OSRM-Proxy | **Mittel** | Missbrauch als Open-Proxy / OSRM-Last. |
| `/api/user/origin` | GET | Geschützt | ja | Settings des Users | nein | Photon-Geocoding | Niedrig | |
| `/api/seed` | POST | Geschützt | ja | `runSeed` für `user.id` | nein | Testdaten | **Hoch** in Prod | Wenn Route in Produktion erreichbar: Datenmüll / DoS — Abschaltung/Feature-Flag prüfen. |

### Admin (leichtgewichtig)

| Pfad | Methoden | Öffentlich / Geschützt | Auth | Ownership/Rolle | Service Role | Sonderfall | Priorität | Anmerkung |
|------|----------|------------------------|------|-------------------|--------------|------------|-----------|-----------|
| `/api/admin/session` | GET | **Hybrid** | optional | `isAdminUserId` | nein | Liefert `{ admin: false }` ohne Login | **Niedrig** | Keine Secrets; nur Admin-Flag + optionale Stats — trotzdem nicht für sensitive Infos erweitern. |

---

## Routen nach Gruppe

| Gruppe | Routen (Kurz) |
|--------|----------------|
| **Stripe Webhook** | `stripe/webhook` |
| **Stripe User-Flows** | `stripe/checkout`, `portal`, `setup-intent/prepare`, `subscription/*`, `payment-method/set-default`, `directory/top-profile/checkout` |
| **Billing lesen** | `billing/account`, `billing/invoices`, `billing/payment-method` |
| **Cron** | `cron/appointment-reminders`, `cron/data-export-cleanup`, `cron/data-export-jobs` |
| **Öffentliche Token/Signatur** | `appointments/confirm`, `export/email-download`, `auth/password-reset/*` |
| **E-Mail (Session)** | `email/send`, `email/appointment-*` |
| **Export (Session)** | `export/full`, `export/jobs`, `export/jobs/[id]` |
| **KI** | `ai/improve-text`, `ai/format-documentation`, `ai/transcribe` |
| **Mobile/Dashboard** | `dashboard/*`, `calendar/mobile`, `appointments/*`, `customers/*`, `horses/*`, `search` |
| **Rechnungen** | `invoices/[id]/send-email`, `invoices/test` |
| **Settings & Hilfe** | `settings`, `route-distance`, `user/origin` |
| **Dev/Test** | `seed` |
| **Admin-Hinweis** | `admin/session` |

---

## Muster: gemeinsame Helper (für spätere Phasen, nicht umgesetzt)

- **Standard-App-API:** `createSupabaseServerClient` + `getUser()` → 401 bei fehlendem User (Ausnahme: bewusst öffentliche Routen).
- **Billing-geschützter Export:** bereits `requireExportAccess()` in `export/jobs`, `export/full`.
- **Stripe schreibend:** Session-User + `createSupabaseServiceRoleClient` nur für serverseitige Stripe-Kopplung — User-Zuordnung im Code prüfen.
- **ID-Verifikation:** Ressourcen mit `.eq('user_id', user.id)` oder explizitem Row-Check nach Fetch (`export/jobs/[id]`).

---

## Bewusst öffentlich (oder ohne Login)

- `POST /api/stripe/webhook` (Signatur)
- `GET /api/cron/*` (Bearer Secret)
- `GET`/`POST /api/appointments/confirm` (Token)
- `GET /api/export/email-download` (signierte Query)
- `POST /api/auth/password-reset/request` und `confirm`
- `GET /api/admin/session` (ohne Login nur `{ admin: false }` — kein Schutzbedarf für die aktuelle Antwort)

---

## **Niemals** pauschal per Cookie-Session-Middleware absichern

Diese Endpunkte **brauchen** anonyme oder spezielle Aufrufer:

| Grund | Beispiele |
|-------|-----------|
| Stripe ruft ohne User-Cookie auf | `/api/stripe/webhook` |
| Cron / Infra | `/api/cron/*` |
| Link in E-Mail / SMS | `/api/appointments/confirm`, `/api/export/email-download` |
| Passwort-Reset-Formular (nicht eingeloggt) | `/api/auth/password-reset/*` |

Eine globale „alle `/api` nur mit Session“-Middleware würde diese Flows **brechen**.

---

## Top-Risiken (Priorität **Kritisch** / **Hoch**) — Kurz

1. **Kritisch:** `POST /api/stripe/webhook` — Signatur + Idempotenz; Service Role.
2. **Kritisch:** `GET /api/cron/*` — `CRON_SECRET` schützt Massenjobs/E-Mails/Löschung.
3. **Hoch:** `POST /api/auth/password-reset/confirm` — Token-Modell; Service Role.
4. **Hoch:** `GET /api/export/email-download` — Signaturgeheimnis + ZIP-Auslieferung.
5. **Hoch:** `GET`/`POST /api/appointments/confirm` — Terminänderung per Token; Service Role.

Zusätzlich **Hoch** bei Missbrauch (nicht „Auth vergessen“, aber Kosten/Schaden): **`/api/ai/*`**, **`POST /api/seed`** in Produktion.

---

## Dokumentierte Unsicherheiten

- **RLS:** Ob alle `select/insert/update` ohne expliziten `user_id`-Filter trotzdem sicher sind, hängt von den Supabase-Policies ab — hier **nicht** verifiziert.
- **`/api/dashboard/revenue`:** Verhalten ohne Session (200 + Nullen) ist **absichtlich oder historisch** — fachlich klären, ob 401 konsistenter wäre.
- **Cron-Helper:** Ob intern Service Role genutzt wird, steht in `lib/…` — für Cleanup/Export-Jobs-Cron in separater Tiefe nachlesen.

---

## Nächste Schritte (ableitbar, nicht Teil S4a)

1. Rate-Limits für **öffentliche** und **KI**-Routen.
2. Produktions-Policy für **`/api/seed`** (deaktivieren oder Admin-only).
3. Einheitliche **`requireSession()`**-Helper für geschützte Routen + Audit der **Ausnahmeliste** oben.
4. Monitoring-Alerts auf **Webhook**-Fehler und **Cron**-401-Spikes.
5. RLS-Review parallel zu den „**Unsicher**“ markierten Aggregationen (`dashboard/mobile`).
