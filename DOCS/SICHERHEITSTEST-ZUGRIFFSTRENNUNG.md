# Test: Zugriffstrennung (Multi-Tenant)

Prüfen, dass jeder Hufbearbeiter nur **eigene** Daten sieht und kein Zugriff auf Daten anderer Nutzer möglich ist.

---

## Voraussetzungen

- Beide RLS-Migrationen sind in Supabase ausgeführt:
  - `20250316000000_rls_core_tables.sql` (Tabellen)
  - `20250316000001_storage_hoof_photos_rls.sql` (Bucket hoof-photos)
- Zwei Test-Accounts (z. B. zwei E-Mail-Adressen mit eigenem Login)

---

## 1. Daten pro Nutzer anlegen

**Mit Nutzer A einloggen:**

- 1–2 Kunden anlegen (Name merken, z. B. „Test-Kunde A“).
- 1–2 Pferde anlegen und einem Kunden zuordnen.
- Optional: 1 Termin, 1 Hufdokumentation mit Foto, 1 Rechnung (Entwurf).

**Mit Nutzer B einloggen:**

- 1–2 **andere** Kunden anlegen (z. B. „Test-Kunde B“).
- 1–2 **andere** Pferde anlegen.
- Optional: Termin, Dokumentation, Rechnung.

So haben A und B jeweils nur ihre eigenen Daten in der App angelegt.

---

## 2. Sichtbarkeit in der App prüfen

**Mit Nutzer A eingeloggt:**

| Bereich | Erwartung |
|--------|-----------|
| **Dashboard** | Nur Zähler/Listen von A (Kunden, Pferde, Termine, Dokumentationen). |
| **Kunden** | Nur „Test-Kunde A“ (keine Kunden von B). |
| **Pferde** | Nur Pferde von A. |
| **Suche** (z. B. Name von B’s Kunde eingeben) | Keine Treffer zu B’s Daten. |
| **Kalender** | Nur Termine von A. |
| **Rechnungen** (über Kunden oder /invoices) | Nur Rechnungen von A. |
| **Einstellungen** | Nur A’s Einstellungen (Logo, Adresse etc.). |

**Mit Nutzer B eingeloggt:**  
Gleiche Prüfung: Es erscheinen nur B’s Kunden, Pferde, Termine, Rechnungen, Einstellungen – **keine** von A.

---

## 3. IDOR-Check (fremde IDs in der URL)

Nutzer A ist eingeloggt. In der Adresszeile **fremde** IDs von Nutzer B ausprobieren:

1. **Kunde von B:**  
   `/customers/<B-Kunden-UUID>`  
   → Erwartung: „Kunde nicht gefunden“ oder 404, **keine** Daten von B.
2. **Pferd von B:**  
   `/horses/<B-Pferd-UUID>`  
   → Erwartung: „Pferd nicht gefunden“ oder 404.
3. **Rechnung von B:**  
   `/invoices/<B-Rechnungs-UUID>`  
   → Erwartung: „Rechnung nicht gefunden“ oder 404.
4. **Rechnung als PDF:**  
   `/invoices/<B-Rechnungs-UUID>/pdf`  
   → Erwartung: 404 oder Fehlermeldung, **kein** PDF mit B’s Daten.
5. **Hufdokumentation von B:**  
   `/horses/<B-Pferd-UUID>/records/<B-Record-UUID>`  
   → Erwartung: „Dokumentation nicht gefunden“ oder 404.
6. **PDF Hufdokumentation:**  
   `/horses/<B-Pferd-UUID>/records/<B-Record-UUID>/pdf`  
   → Erwartung: 404 oder Fehler, **kein** PDF von B.

Die UUIDs von B bekommst du, indem du dich als B einloggst, eine Kunden-/Pferde-/Rechnungs-/Record-Seite öffnest und die ID aus der URL kopierst.

---

## 4. API-Routen (nur eigener Zugriff)

**Als Nutzer A eingeloggt:**

- **Einstellungen speichern:**  
  Request an `/api/settings` (POST mit A’s Einstellungen).  
  → Erwartung: 200, Änderungen betreffen nur A.
- **Test-Rechnung:**  
  Request an `/api/invoices/test` (POST mit `customerId: <A-Kunden-UUID>`).  
  → Erwartung: 200, neue Rechnung gehört zu A.  
  Derselbe Request mit **B’s Kunden-UUID** (falls du sie kennst):  
  → Erwartung: 404 „Kunde nicht gefunden oder kein Zugriff“.

---

## 5. Abmelden / Fremdzugriff

- **Ohne Login:**  
  Direktaufruf z. B. `/dashboard`, `/customers`, `/invoices`, `/settings`, `/suche`.  
  → Erwartung: Weiterleitung zu `/login`, keine Daten sichtbar.
- **Nach Logout:**  
  Erneut z. B. `/customers` aufrufen.  
  → Erwartung: Weiterleitung zu `/login`.

---

## 6. Kurz-Checkliste

- [ ] Zwei Nutzer mit je eigenen Daten angelegt.
- [ ] Dashboard, Kunden, Pferde, Suche, Kalender, Rechnungen, Einstellungen zeigen pro Nutzer nur seine Daten.
- [ ] Fremde URLs (Kunde/Pferd/Rechnung/Record von B) liefern als A: „nicht gefunden“/404, keine fremden Daten.
- [ ] PDF-Routen für Rechnung und Hufdokumentation liefern bei fremder ID 404/Fehler.
- [ ] Geschützte Bereiche ohne Login → Redirect zu `/login`.
- [ ] `/api/invoices/test` mit fremder Kunden-ID → 404/kein Zugriff.

Wenn alle Punkte so eintreten, ist die Zugriffstrennung in App und (mit aktiven RLS-Policies) in der Datenbank erfüllt.
