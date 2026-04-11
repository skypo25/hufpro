# Session-Helper für API-Routen (S4b)

## Helper

- **`lib/auth/requireUserSession.server.ts`** — `requireUserSession()`: liefert `{ ok: true, user, supabase }` oder `{ ok: false, response }` mit **401** und `{ error: 'Nicht angemeldet' }`.

## Zuerst umgestellt (Muster)

| Route | Grund |
|-------|--------|
| `POST /api/settings` | Typische geschützte Schreib-API; bereits deutsche 401-Meldung. |
| `GET /api/user/origin` | Schlanke GET-API, nur Session + eigene Einstellungen. |
| `GET /api/billing/account` | Billing-Lese-API ohne Webhook/Service-Role-Sonderlogik in der Auth-Zeile. |
| `GET /api/appointments/today-count` | Einfache Aggregation nur für eingeloggte Nutzer. |

## Bewusst noch nicht umgestellt (Auswahl)

- **Webhook, Cron, Token-Links, Password-Reset** — keine Session-Cookies, Helper ungeeignet.
- **Stripe-Checkout, KI, E-Mail-Versand, große Mobile-Aggregatoren** — später batchweise; hier nur kleines Muster.
- **`GET /api/dashboard/revenue`** — liefert ohne Session absichtlich leere Daten (200); Umstellung würde Verhalten ändern → nicht anfassen.
