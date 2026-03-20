# Sicherheitsbericht – AniDocs

Stand: Prüfung des gesamten Projekts auf Sicherheit. Wichtige Punkte und umgesetzte Maßnahmen.

---

## 1. Authentifizierung & Zugriffskontrolle

### Middleware (Seiten)
- **Geschützte Bereiche:** `/`, `/dashboard`, `/customers`, `/horses`, `/calendar`, `/suche`, `/invoices`, `/settings`, `/appointments` erfordern Login.
- **Öffentlich:** `/login`, `/termin-bestaetigen/[token]` (nur mit gültigem Token).
- **Root `/`:** Weiterleitung zu `/login` (nicht eingeloggt) bzw. `/dashboard` (eingeloggt). Keine technischen Infos auf der Startseite.

### API-Routen
Alle relevanten API-Routen prüfen den eingeloggten User und geben sonst **401** zurück:

| Route | Auth | Anmerkung |
|-------|------|-----------|
| `POST /api/email/send` | ja | `getUser()`, sonst 401 |
| `POST /api/email/appointment-confirmed` | ja | Nur eigene Termine |
| `POST /api/email/appointment-proposed` | ja | Nur eigene Termine |
| `POST /api/settings` | ja | Upsert nur mit `user_id` |
| `GET /api/customers/[id]/horses` | ja | Abfrage mit `.eq('user_id', user.id)` |
| `POST /api/seed` | ja | Seed nur für eigenen User |
| `POST /api/invoices/test` | ja | Kunde mit `.eq('user_id', user.id)` |

**Öffentlich (by Design):**
- `GET/POST /api/appointments/confirm` – Zugriff nur per **Token** (aus E-Mail). Kein Login. Service-Role-Client nur serverseitig, Token zufällig und mit Ablaufdatum.

---

## 2. Datenbank (RLS – Row Level Security)

Multi-Tenant-Isolation: Alle Abfragen nutzen `user_id`; RLS erzwingt `auth.uid() = user_id`.

- **Tabellen mit RLS:** `horses`, `customers`, `appointments`, `appointment_horses`, `hoof_records`, `hoof_photos`, `invoices`, `invoice_items`, `user_settings`.
- **Policies:** Nur Lese-/Schreibzugriff auf Zeilen mit eigenem `user_id`.
- **Service-Role:** Wird ausschließlich für `/api/appointments/confirm` und die Seite `/termin-bestaetigen/[token]` verwendet (Token-Lookup, Status-Update). Der Key liegt nur in Umgebungsvariablen (z. B. `.env.local`), nicht im Frontend.

---

## 3. Geheimnisse & Umgebungsvariablen

- **`.env*`** ist in der `.gitignore` – keine Env-Dateien mit Keys im Repository.
- **NEXT_PUBLIC_*** nur für nicht-sensible Werte (z. B. Supabase-URL, Anon-Key). Der **SUPABASE_SERVICE_ROLE_KEY** hat kein `NEXT_PUBLIC_` und wird nur serverseitig verwendet.
- **SMTP-Passwort** liegt in `user_settings` (DB), wird nicht an den Client zurückgegeben und nur in API-Routen für E-Mail-Versand genutzt.

---

## 4. Termin-Bestätigung (Vorgeschlagen → Link)

- **Token:** 32 Bytes Zufall (hex), einmalig pro Termin, in DB mit Ablaufdatum (z. B. 14 Tage).
- **GET /api/appointments/confirm?token=…** liefert nur Termin-Details (Datum, Uhrzeit, Art, Pferde, Notizen) – keine E-Mail, keine `user_id`.
- **POST /api/appointments/confirm** setzt nur bei gültigem, nicht abgelaufenem Token den Status auf „Bestätigt“ und entfernt den Token.
- Bestätigungsseite und -API nutzen den Service-Role-Client nur serverseitig; der Token wird nicht im Frontend-Code geloggt.

---

## 5. Injection & XSS

- **Kein `dangerouslySetInnerHTML`** im Projekt.
- Supabase-Client nutzt parametrisierte Abfragen – **keine Roh-SQL-Strings** aus User-Input.
- React escaped Ausgaben standardmäßig; E-Mail/PDF-Inhalte werden aus strukturierten Daten gebaut (Datum, Text aus DB).

---

## 6. Storage (Fotos, Logos)

- **hoof-photos:** RLS auf `storage.objects`: SELECT/UPDATE/DELETE nur mit `owner_id = auth.uid()`. INSERT auf Bucket `hoof-photos` (Owner wird beim Upload gesetzt).
- **user-logos:** Eigenes Verzeichnis pro User (z. B. anhand `auth.uid()`), RLS entsprechend.

---

## 7. Umgesetzte Anpassungen (bei der Prüfung)

1. **Root-Route `/`:** Keine technischen Infos mehr; Weiterleitung zu `/login` oder `/dashboard`. Kein `console.log` mit Supabase-Client.
2. **Middleware:** `/` und `/termin-bestaetigen/:path*` im Matcher; geschützte Bereiche inkl. `/` konsistent abgedeckt; Bestätigungs-URL bleibt ohne Login erreichbar.

---

## 8. Empfehlungen (optional)

- **Rate-Limiting:** Für öffentliche Endpunkte (z. B. `/api/appointments/confirm`) und Login-Seite ggf. Rate-Limiting (z. B. Vercel/Next.js-Middleware oder externer Dienst).
- **HTTPS:** In Produktion ausschließlich HTTPS (z. B. über Vercel/Provider).
- **Service-Role-Key:** Nach Möglichkeit rotieren, falls er einmal außerhalb der Env-Dateien gelandet ist (z. B. durch Copy/Paste).
- **Security-Headers:** Für Produktion z. B. CSP, X-Frame-Options, HSTS in Next.js-Config oder beim Host setzen.

---

## 9. Kurz-Checkliste

- [x] Geschützte Seiten nur nach Login
- [x] API-Routen prüfen Auth und `user_id`
- [x] RLS auf allen relevanten Tabellen
- [x] Keine Geheimnisse im Frontend/Repository
- [x] Bestätigungs-Link nur per Token, mit Ablauf
- [x] Kein gefährliches HTML/JS aus User-Input
- [x] Root `/` leitet weiter, keine technischen Infos

Die Anwendung ist für den bestimmten Use-Case (Multi-Tenant, Hufbearbeiter mit eigenen Kunden/Daten) mit den beschriebenen Maßnahmen sicher betreibbar. Bei neuen Features (z. B. weitere öffentliche Links oder APIs) Auth und RLS erneut prüfen.
