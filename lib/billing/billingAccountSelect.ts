/**
 * Alle Spalten von billing_accounts.
 * Bewusst `*`: Wenn eine Migration (z. B. `post_cancel_access_until`) noch nicht angewendet ist,
 * schlagen feste Spaltenlisten in PostgREST fehl — dann lädt Billing nicht und die Middleware
 * kann fälschlich nur noch /billing zulassen.
 */
export const BILLING_ACCOUNT_COLUMNS = '*'
