import Link from 'next/link'
import { fetchAdminGlobalCounts } from '@/lib/admin/data'
import { formatGermanDateTime } from '@/lib/format'
import { adminCardClass, adminMutedClass, adminPageTitleClass, adminSectionHeaderClass } from '@/components/admin/adminStyles'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import { saveSystemSmtp, testSystemSmtp } from './actions'

export const dynamic = 'force-dynamic'

export default async function AdminSystemPage(props: {
  searchParams: Promise<{ saved?: string; err?: string; msg?: string }>
}) {
  const sp = await props.searchParams
  let webhookRows: { event_id: string; event_type: string; received_at: string | null }[] = []
  let webhookErr: string | null = null
  let counts: Awaited<ReturnType<typeof fetchAdminGlobalCounts>> | null = null
  let countErr: string | null = null

  try {
    counts = await fetchAdminGlobalCounts()
    webhookRows = counts.webhookRows
    webhookErr = counts.webhookError
  } catch (e) {
    countErr = e instanceof Error ? e.message : 'Konnte keine Systemdaten laden.'
  }

  const now = formatGermanDateTime(new Date().toISOString())
  const stripeWebhookUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')}/api/stripe/webhook`
    : null
  const db = createSupabaseServiceRoleClient()
  const { data: smtpRow } = await db.from('system_smtp').select('*').eq('id', 1).maybeSingle()

  return (
    <div className="space-y-5">
      <div>
        <h1 className={adminPageTitleClass}>System</h1>
        <p className={`${adminMutedClass} mt-1`}>Ruhiger Überblick · {now}</p>
      </div>

      {sp.saved === 'smtp' ? (
        <div className="rounded-xl border border-[rgba(82,183,136,.25)] bg-[rgba(82,183,136,.06)] px-4 py-3 text-[13px] text-[#154227]">
          <strong className="font-semibold">Gespeichert.</strong> System SMTP wurde aktualisiert.
        </div>
      ) : sp.saved === 'smtp_test' ? (
        <div className="rounded-xl border border-[rgba(82,183,136,.25)] bg-[rgba(82,183,136,.06)] px-4 py-3 text-[13px] text-[#154227]">
          <strong className="font-semibold">OK.</strong> Test-E-Mail wurde versendet.
        </div>
      ) : null}
      {sp.err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-900">
          <strong className="font-semibold">Fehler.</strong> {sp.msg ?? 'Aktion fehlgeschlagen.'}
        </div>
      ) : null}

      {countErr ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
          {countErr}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={adminCardClass}>
          <div className={adminSectionHeaderClass}>
            <i className="bi bi-heart-pulse text-[15px] text-[#52b788]" aria-hidden />
            <h2 className="font-[family-name:var(--font-outfit)] text-[14px] font-semibold text-[#1B1F23]">
              App & Datenhaltung
            </h2>
          </div>
          <div className="space-y-3 px-5 py-4 text-[13px] text-[#374151]">
            <StatusRow label="Next.js App" status="Betrieb" ok />
            <StatusRow label="Postgres (Supabase)" status="Verbunden" ok />
            <StatusRow
              label="Bild-Storage"
              status={counts ? `${counts.hoofPhotos.toLocaleString('de-DE')} Fotos erfasst` : '—'}
              ok={!!counts}
            />
            <p className="text-[11px] leading-relaxed text-[#9CA3AF]">
              Live-Diagnose (Uptime, Latenz) ist in V1 nicht angebunden — hier siehst du nur, was aus der Datenbank
              ableitbar ist.
            </p>
          </div>
        </div>

        <div className={adminCardClass}>
          <div className={adminSectionHeaderClass}>
            <i className="bi bi-stripe text-[15px] text-[#635BFF]" aria-hidden />
            <h2 className="font-[family-name:var(--font-outfit)] text-[14px] font-semibold text-[#1B1F23]">
              Stripe Webhooks (Audit)
            </h2>
          </div>
          <div className="px-5 py-4">
            {webhookErr ? (
              <p className="text-[13px] text-[#6B7280]">{webhookErr}</p>
            ) : webhookRows.length === 0 ? (
              <div className="space-y-2 text-[12px] leading-relaxed text-[#6B7280]">
                <p>
                  Nur <strong className="font-semibold text-[#475569]">eingehende Stripe-Webhooks</strong> landen hier — nicht
                  Admin-Aktionen an der Stripe-API.
                </p>
                <p>
                  Stripe: Endpoint in Test/Live auf diese App setzen,{' '}
                  <code className="rounded bg-[#F1F5F9] px-1 py-0.5 font-mono text-[11px]">STRIPE_WEBHOOK_SECRET</code> zum
                  Signing Secret.
                </p>
                {stripeWebhookUrl ? (
                  <p className="font-mono text-[11px] text-[#64748B] break-all">URL: {stripeWebhookUrl}</p>
                ) : null}
              </div>
            ) : (
              <ul className="space-y-2">
                {webhookRows.slice(0, 8).map((w) => (
                  <li key={w.event_id} className="flex flex-col gap-0.5 border-b border-[#F0EEEA] py-2 text-[11px] last:border-0">
                    <span className="font-mono text-[12px] text-[#1B1F23]">{w.event_type}</span>
                    <span className="text-[#9CA3AF]">
                      {w.received_at ? formatGermanDateTime(w.received_at) : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className={adminCardClass}>
        <div className={adminSectionHeaderClass}>
          <i className="bi bi-envelope-at-fill text-[15px] text-[#2563EB]" aria-hidden />
          <h2 className="font-[family-name:var(--font-outfit)] text-[14px] font-semibold text-[#1B1F23]">
            System SMTP (noreply@anidocs.de)
          </h2>
        </div>
        <div className="px-5 py-4">
          <p className="mb-3 text-[12px] text-[#6B7280]">
            Diese SMTP-Daten werden für App-E-Mails wie Passwort-Reset und 2FA genutzt (nicht für Supabase Auth-Systemmails).
          </p>
          <form action={saveSystemSmtp} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF]">Host</span>
              <input name="host" defaultValue={smtpRow?.host ?? ''} className="rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#52b788]" required />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF]">Port</span>
              <input name="port" type="number" defaultValue={smtpRow?.port ?? 587} className="rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#52b788]" required />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF]">User</span>
              <input name="user" defaultValue={smtpRow?.smtp_user ?? ''} className="rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#52b788]" required />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF]">Passwort</span>
              <input
                name="password"
                type="password"
                placeholder={smtpRow?.password ? '•••••••• (gespeichert)' : 'SMTP Passwort'}
                className="rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#52b788]"
              />
              <span className="mt-1 text-[11px] text-[#9CA3AF]">Leer lassen, um das bestehende Passwort beizubehalten.</span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF]">Secure</span>
              <select name="secure" defaultValue={(smtpRow?.secure ?? false) ? 'true' : 'false'} className="rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#52b788]">
                <option value="false">STARTTLS (587)</option>
                <option value="true">TLS (465)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF]">From E-Mail</span>
              <input name="from_email" defaultValue={smtpRow?.from_email ?? 'noreply@anidocs.de'} className="rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#52b788]" />
            </label>
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF]">From Name</span>
              <input name="from_name" defaultValue={smtpRow?.from_name ?? 'AniDocs'} className="rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#52b788]" />
            </label>
            <div className="md:col-span-2">
              <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-[#52b788] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#0f301b]">
                <i className="bi bi-check-lg" aria-hidden />
                SMTP speichern
              </button>
            </div>
          </form>

          <div className="mt-4 border-t border-[#E5E2DC] pt-4">
            <form action={testSystemSmtp} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF]">Test an</span>
                <input
                  name="to"
                  placeholder="(leer = an Admin E-Mail)"
                  className="rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#52b788]"
                />
              </label>
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#1B1F23] hover:border-[#2563EB] hover:bg-[#EFF6FF]">
                <i className="bi bi-send-fill" aria-hidden />
                Test-E-Mail senden
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className={adminCardClass}>
        <div className={adminSectionHeaderClass}>
          <i className="bi bi-info-circle-fill text-[15px] text-[#3B82F6]" aria-hidden />
          <h2 className="font-[family-name:var(--font-outfit)] text-[14px] font-semibold text-[#1B1F23]">
            Hinweise
          </h2>
        </div>
        <div className="space-y-2 px-5 py-4 text-[13px] leading-relaxed text-[#6B7280]">
          <p>
            Admin-Zugriff wird über <code className="rounded bg-[#F3F4F6] px-1 font-mono text-[11px]">ADMIN_USER_IDS</code>{' '}
            in der Server-Umgebung begrenzt.
          </p>
          <p>
            Aggregierte Kennzahlen nutzen den{' '}
            <strong className="font-semibold text-[#1B1F23]">Service-Role-Key</strong> und laufen nur auf dem Server.
          </p>
          <p>
            <Link href="/admin" className="font-semibold text-[#52b788] hover:underline">
              Zum Dashboard
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function StatusRow(props: { label: string; status: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${props.ok ? 'bg-[#52b788]' : 'bg-[#F97316]'}`}
        aria-hidden
      />
      <span className="flex-1 font-medium text-[#1B1F23]">{props.label}</span>
      <span className={`text-[12px] font-semibold ${props.ok ? 'text-[#52b788]' : 'text-[#F97316]'}`}>
        {props.status}
      </span>
    </div>
  )
}
