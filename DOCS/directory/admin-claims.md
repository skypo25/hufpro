# Admin: Directory Claim Review

Internes Admin-Panel (`/admin/directory/claims`), gleiche Absicherung wie übriges Admin (`requireAdmin`, Middleware, `ADMIN_USER_IDS`).

## Ablauf

1. **Liste** lädt alle Zeilen aus `directory_claims` und dazugehörige Profilköpfe aus `directory_profiles` (nur Server, **Service Role**).
2. **Detail** (`/admin/directory/claims/[id]`) zeigt Profilstatus, Owner-Felder, Antragsteller (Snapshot + `claimant_user_id`), Nachricht, optional `proof_url`.
3. **Annehmen** (`approveAdminDirectoryClaim`): nur wenn Claim noch `pending`.
4. **Ablehnen** (`rejectAdminDirectoryClaim`): optional `rejection_reason`.
5. **E-Mail an Antragsteller** (nach erfolgreichem Approve/Reject, **best effort**): siehe unten.

Kein öffentliches UI; keine Client-Updates auf die Tabellen ohne Server Action.

## E-Mail bei Entscheidung (Angenommen / Abgelehnt)

- **Versand:** `lib/directory/claims/sendClaimDecisionEmail.server.ts` über **System-SMTP** (`system_smtp`, wie Datenexport-Fertig-Mail). Ohne konfiguriertes SMTP: nur `console.warn`, Admin-Aktion bleibt erfolgreich.
- **Empfänger:** zuerst **E-Mail aus Supabase Auth** (`auth.admin.getUserById`), sonst Fallback **`claimant_email`** aus dem Claim-Formular (Snapshot).
- **Inhalt:**
  - **Angenommen:** Kurztext + Links zu `NEXT_PUBLIC_APP_URL` (Fallback wie Export-Mail): `/login`, `/directory/mein-profil`, `/behandler/[slug]`.
  - **Abgelehnt:** Kurztext; optionaler **`rejection_reason`** aus dem Admin-Formular.
- **Hinweis:** Liegt das öffentliche Verzeichnis auf einer **anderen Domain** als die App, kann der Link `/behandler/…` in der Mail ggf. angepasst werden (später z. B. eigenes Env für Marketing-URL).

## Approve — gesetzte Felder

| Tabelle | Felder |
|--------|--------|
| `directory_claims` | `status = approved`, `decided_at`, `decided_by_user_id`, `rejection_reason = null` |
| `directory_profiles` | `claimed_by_user_id = claimant_user_id`, `claim_state = claimed` |

Voraussetzung: Profilzeile erfüllt `claimed_by_user_id IS NULL OR claimed_by_user_id = claimant_user_id`. Sonst wird das Claim-Update **zurückgerollt** (wieder `pending`) und eine Fehlermeldung angezeigt.

## Reject — gesetzte Felder

| Tabelle | Felder |
|--------|--------|
| `directory_claims` | `status = rejected`, `decided_at`, `decided_by_user_id`, `rejection_reason` (optional) |

Zusatz (für späteres `claim_pending` am Profil): Wenn **kein** weiterer `pending`-Claim für dasselbe Profil existiert und `claim_state = claim_pending`, wird `claim_state` auf `unclaimed` gesetzt. Im aktuellen öffentlichen Antrag bleibt das Profil bei Einreichung `unclaimed`; dieser Schritt ist damit meist wirkungslos, aber zukunftssicher.

## MVP-Annahmen

- Maximal **ein** `pending`-Claim pro Profil (DB: partieller Unique-Index).
- Parallele „konkurrierende“ Pending-Claims sind damit ausgeschlossen; Konflikte entstehen vor allem, wenn ein Profil **manuell** oder durch Alt-Daten einen anderen `claimed_by_user_id` hat — dann ist **Annehmen** in der UI deaktiviert bzw. schlägt serverseitig mit Rollback fehl.
- Audit: `admin_audit_events` mit `directory_claim.approve` / `directory_claim.reject` (best effort).

## Technik

- Daten + Mutationen: `createSupabaseServiceRoleClient()` aus `lib/supabase-service.ts`.
- Aktionen: `lib/admin/directoryClaimsActions.ts` (`'use server'`).
- UI-Forms: `components/admin/directory/AdminClaimActionForms.tsx` (Client nur für Bestätigungsdialog + `useFormStatus`).
