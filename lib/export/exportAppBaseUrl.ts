import 'server-only'

/** Basis-URL für Links in System-Mails (Datenexport, …). */
export function getExportAppBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL
  if (url) return url.startsWith('http') ? url.replace(/\/+$/, '') : `https://${url.replace(/\/+$/, '')}`
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3000'
  return 'https://app.anidocs.de'
}
