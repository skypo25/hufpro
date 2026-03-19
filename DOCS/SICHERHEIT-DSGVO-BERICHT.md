# Sicherheits- und DSGVO-Bericht – Hufpflege-App

**Stand:** Vollständige Prüfung des Projekts  
**Datum:** März 2025

---

## Teil 1: Sicherheit

### 1.1 Authentifizierung & Zugriffskontrolle

#### Middleware (Seiten)
- **Geschützte Bereiche:** `/`, `/dashboard`, `/customers`, `/horses`, `/calendar`, `/suche`, `/invoices`, `/settings`, `/appointments` erfordern Login.
- **Öffentlich:** `/login`, `/register`, `/termin-bestaetigen/[token]` (nur mit gültigem Token).
- **Root `/`:** Weiterleitung zu `/login` (nicht eingeloggt) bzw. `/dashboard` (eingeloggt).

**Hinweis:** Die Middleware schützt nur **Seiten**, nicht API-Routen. Jede API-Route prüft separat `supabase.auth.getUser()`.

#### API-Routen – Auth-Status

| Route | Auth | Anmerkung |
|-------|------|-----------|
| `POST /api/email/send` | ✅ | getUser(), sonst 401 |
| `POST /api/email/appointment-confirmed` | ✅ | Nur eigene Termine |
| `POST /api/email/appointment-proposed` | ✅ | Nur eigene Termine |
| `POST /api/settings` | ✅ | Upsert nur mit user_id |
| `GET /api/customers/[id]/horses` | ✅ | .eq('user_id', user.id) |
| `POST /api/seed` | ✅ | Seed nur für eigenen User |
| `POST /api/invoices/test` | ✅ | Kunde mit user_id |
| `GET /api/route-distance` | ❌ | **Keine Auth** – Proxy zu OSRM, niedriges Risiko |
| `GET/POST /api/appointments/confirm` | Token | Öffentlich by Design, nur per Token |

**PDF-Routen** (`/invoices/[id]/pdf`, `/horses/[id]/records/[recordId]/pdf`): ✅ Auth + user_id-Scoping.

---

### 1.2 Datenbank (RLS)

- **Tabellen mit RLS:** `horses`, `customers`, `appointments`, `appointment_horses`, `hoof_records`, `hoof_photos`, `invoices`, `invoice_items`, `user_settings`.
- **Policies:** Nur Zugriff auf Zeilen mit `auth.uid() = user_id`.
- **Service-Role:** Nur für `/api/appointments/confirm` und `/termin-bestaetigen/[token]`; Key nicht im Frontend.

---

### 1.3 Geheimnisse & Umgebungsvariablen

- `.env*` in `.gitignore` – keine Keys im Repository.
- `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` nur serverseitig.
- SMTP-Passwort in `user_settings` (DB), wird nicht an den Client zurückgegeben.

---

### 1.4 XSS & Injection

| Bereich | Status | Anmerkung |
|---------|--------|-----------|
| `record.hoof_condition` | ✅ | `sanitiseHtml()` vor `dangerouslySetInnerHTML` |
| `record.summary_notes` (MobileRecordDetail) | ⚠️ | **Keine Sanitization** – potenzielles XSS |
| MinimalRichEditor | ⚠️ | Erlaubt beliebiges HTML via contentEditable |
| Supabase-Queries | ✅ | Parametrisiert, keine Roh-SQL |

**Empfehlung:** `summary_notes` vor Anzeige mit `sanitiseHtml()` (oder DOMPurify) bereinigen.

---

### 1.5 Storage

- **hoof-photos:** RLS auf `storage.objects`, nur eigener `owner_id`.
- **user-logos:** Eigenes Verzeichnis pro User, RLS entsprechend.

---

### 1.6 Offene Punkte (Sicherheit)

1. **`/api/route-distance`** – Keine Auth. Nur Koordinaten-Proxy zu OSRM; Risiko: Missbrauch/DDoS. Optional: Auth oder Rate-Limit.
2. **`summary_notes` XSS** – Sanitization ergänzen.
3. **Rate-Limiting** – Für `/api/appointments/confirm` und Login empfohlen.
4. **Security-Headers** – CSP, X-Frame-Options, HSTS in Produktion setzen.

---

## Teil 2: DSGVO-Konformität

### 2.1 Datenerhebung & Zweckbindung

**Erhobene personenbezogene Daten:**
- Nutzer: E-Mail, Name (optional), Passwort (gehashed durch Supabase)
- Kunden: Name, Adresse, Telefon, E-Mail, Terminpräferenzen
- Betriebsdaten (user_settings): Name, Adresse, Steuer, Bank, IBAN, ggf. SMTP

**Zweck:** Betriebs- und Terminverwaltung für Hufbearbeiter. Keine Weitergabe an Dritte außer technisch notwendig (Supabase, OpenAI für KI-Features, E-Mail-Versand).

---

### 2.2 Rechtmäßigkeit (Art. 6 DSGVO)

- **Vertragserfüllung:** Nutzung der App erfordert Kunden- und Termindaten.
- **Berechtigtes Interesse:** Geschäftsdokumentation, Rechnungen.
- **Einwilligung:** Bei Registrierung AGB + Datenschutzerklärung akzeptiert.

---

### 2.3 Betroffenenrechte

| Recht | Umsetzung |
|-------|-----------|
| **Auskunft (Art. 15)** | Kein standardisierter Abruf – manuell/Support |
| **Berichtigung (Art. 16)** | Nutzer können Daten in der App bearbeiten |
| **Löschung (Art. 17)** | ⚠️ **„Konto löschen“ nur UI** – keine Backend-Logik |
| **Einschränkung (Art. 18)** | Keine technische Umsetzung |
| **Datenübertragbarkeit (Art. 20)** | Keine Export-Funktion |

---

### 2.4 Kritische DSGVO-Lücken

#### 1. Fehlende rechtliche Seiten
- **`/datenschutz`** – Verlinkt (Registrierung), Seite existiert **nicht** (404).
- **`/agb`** – Verlinkt (Registrierung), Seite existiert **nicht** (404).

**Risiko:** Ungültige Einwilligung bei Registrierung, Abmahngefahr.

#### 2. Konto löschen nicht implementiert
- In Einstellungen (Desktop + Mobile): Button „Konto löschen“ vorhanden.
- **Keine API**, kein Lösch-Flow: Keine Datenlöschung, kein Auth-Account-Löschen.

**Risiko:** Verstoß gegen Art. 17 DSGVO (Recht auf Löschung).

#### 3. Drittlandübermittlung (OpenAI)
- Spracherkennung (`/api/ai/transcribe`), Text-Verbesserung (`/api/ai/improve-text`), Formatierung (`/api/ai/format-documentation`) nutzen **OpenAI** (USA).
- In Datenschutzerklärung muss Übermittlung in Drittländer und Rechtsgrundlage (z.B. Standardvertragsklauseln) genannt werden.

---

### 2.5 Bereits DSGVO-konform

- **Datenminimierung:** Nur erforderliche Felder für Betrieb/Termine.
- **Technische Maßnahmen:** HTTPS (Vercel), Supabase mit RLS, Multi-Tenant-Isolation.
- **SMTP-Passwort:** Nicht an Client, nur serverseitig.
- **Einwilligung bei Registrierung:** Checkbox AGB + Datenschutz (aber Links führen zu 404).

---

### 2.6 Empfohlene Maßnahmen (DSGVO)

1. **`/datenschutz`** und **`/agb`** implementieren und mit Inhalt füllen.
2. **„Konto löschen“** umsetzen:
   - API-Route, die alle userbezogenen Daten löscht (customers, horses, appointments, records, photos, user_settings, Storage).
   - Anschließend `supabase.auth.admin.deleteUser(user.id)` (Service-Role).
3. **Datenschutzerklärung** muss enthalten:
   - Verantwortlicher, Kontakt
   - Verarbeitete Daten, Zweck, Rechtsgrundlage
   - Speicherdauer
   - Betroffenenrechte (Auskunft, Berichtigung, Löschung, Widerspruch, Beschwerde bei Aufsichtsbehörde)
   - Übermittlung an OpenAI (USA) + Rechtsgrundlage
   - Cookies (Supabase Auth)
4. **Datenexport** (Art. 20): Optional Export der eigenen Daten (JSON/CSV).

---

## Zusammenfassung

### Sicherheit
- **Stark:** Auth, RLS, Geheimnisse, parametrisierte Queries.
- **Schwächen:** XSS in `summary_notes`, `/api/route-distance` ohne Auth.

### DSGVO
- **Stark:** Datenminimierung, technische Maßnahmen, Einwilligungs-Checkbox.
- **Kritisch:** Fehlende Datenschutz- und AGB-Seiten, Konto-Löschung nicht implementiert.

### Priorität

| Priorität | Maßnahme |
|-----------|----------|
| Hoch | Datenschutzerklärung (`/datenschutz`) und AGB (`/agb`) anlegen |
| Hoch | „Konto löschen“ funktional implementieren |
| Mittel | XSS: `summary_notes` sanitizen |
| Mittel | OpenAI in Datenschutzerklärung erwähnen |
| Niedrig | `/api/route-distance` mit Auth/Rate-Limit versehen |
| Niedrig | Datenexport (Art. 20) optional anbieten |
