import Link from 'next/link'
import { billingBucketLabel, fetchAdminGlobalCounts } from '@/lib/admin/data'
import { formatGermanDateTime } from '@/lib/format'
import {
  adminCardClass,
  adminMutedClass,
  adminPageTitleClass,
  adminSectionHeaderClass,
} from '@/components/admin/adminStyles'

export const dynamic = 'force-dynamic'

function KpiCard(props: {
  label: string
  value: string | number
  hint?: string
  accent?: 'default' | 'green' | 'blue' | 'orange' | 'red' | 'purple'
}) {
  const valColor =
    props.accent === 'green'
      ? 'text-[#52b788]'
      : props.accent === 'blue'
        ? 'text-[#3B82F6]'
        : props.accent === 'orange'
          ? 'text-[#F97316]'
          : props.accent === 'red'
            ? 'text-[#DC2626]'
            : props.accent === 'purple'
              ? 'text-[#8B5CF6]'
              : 'text-[#1B1F23]'
  return (
    <div className={`${adminCardClass} relative overflow-hidden p-4 md:p-[18px]`}>
      <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF]">{props.label}</div>
      <div className={`text-[26px] font-bold leading-none md:text-[28px] ${valColor}`}>{props.value}</div>
      {props.hint ? <div className="mt-1 text-[10px] text-[#9CA3AF]">{props.hint}</div> : null}
    </div>
  )
}

export default async function AdminDashboardPage() {
  let data: Awaited<ReturnType<typeof fetchAdminGlobalCounts>> | null = null
  let loadError: string | null = null
  try {
    data = await fetchAdminGlobalCounts()
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Daten konnten nicht geladen werden.'
  }

  const now = formatGermanDateTime(new Date().toISOString())
  const stripeWebhookUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')}/api/stripe/webhook`
    : null

  const maxProf = data?.professionBars?.[0]?.[1] ?? 1

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className={adminPageTitleClass}>Admin-Dashboard</h1>
          <p className={`${adminMutedClass} mt-1`}>Stand: {now}</p>
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          <Link
            href="/admin/users"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[12px] font-semibold text-[#1B1F23] shadow-sm transition hover:border-[#9CA3AF]"
          >
            Nutzerübersicht
          </Link>
          <Link
            href="/admin/directory/claims"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[12px] font-semibold text-[#1B1F23] shadow-sm transition hover:border-[#9CA3AF]"
          >
            Verzeichnis · Claims
          </Link>
          <Link
            href="/admin/directory/profiles"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[12px] font-semibold text-[#1B1F23] shadow-sm transition hover:border-[#9CA3AF]"
          >
            Verzeichnis · Profile
          </Link>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
          <strong className="font-semibold">Hinweis:</strong> {loadError}
          {loadError.includes('SUPABASE_SERVICE_ROLE_KEY') ? (
            <span className="mt-1 block text-[12px] text-amber-900/90">
              Für Kennzahlen wird der Service-Role-Key benötigt (nur Server).
            </span>
          ) : null}
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
            <KpiCard label="Nutzer gesamt" value={data.totalUsers} />
            <KpiCard label="Aktive Abos" value={data.activeSubscriptions} accent="green" hint="subscription_status = active" />
            <KpiCard label="Trial / trialing" value={data.trialUsers} accent="blue" hint="Trial-Phase oder Stripe trialing" />
            <KpiCard label="Billing-Probleme" value={data.billingProblems} accent="red" hint="past_due / unpaid" />
            <KpiCard label="Dokumentationen (DB)" value={data.documentationRecords} hint="documentation_records" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className={`min-h-0 lg:col-span-2 ${adminCardClass}`}>
              <div className={adminSectionHeaderClass}>
                <i className="bi bi-pie-chart-fill text-[15px] text-[#52b788]" aria-hidden />
                <h2 className="font-[family-name:var(--font-outfit)] text-[14px] font-semibold text-[#1B1F23]">
                  Berufsgruppen (Settings)
                </h2>
              </div>
              <div className="space-y-2 px-5 py-4">
                {data.professionBars.length === 0 ? (
                  <p className="text-[13px] text-[#6B7280]">Noch keine Einträge aus user_settings.</p>
                ) : (
                  data.professionBars.map(([label, count]) => (
                    <div key={label} className="flex items-center gap-2.5">
                      <span className="min-w-[100px] text-[11px] text-[#6B7280]">{label}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded bg-[#F0EEEA]">
                        <div
                          className="h-full rounded bg-[#52b788]"
                          style={{ width: `${Math.min(100, Math.round((count / maxProf) * 100))}%` }}
                        />
                      </div>
                      <span className="min-w-[36px] text-right text-[11px] font-semibold text-[#1B1F23]">{count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className={adminCardClass}>
              <div className={adminSectionHeaderClass}>
                <i className="bi bi-database-fill text-[15px] text-[#52b788]" aria-hidden />
                <h2 className="font-[family-name:var(--font-outfit)] text-[14px] font-semibold text-[#1B1F23]">
                  Nutzungsdaten
                </h2>
              </div>
              <div className="divide-y divide-[#F0EEEA] px-5 py-1">
                <div className="flex justify-between gap-3 py-2.5 text-[13px]">
                  <span className="text-[#6B7280]">hoof_records</span>
                  <span className="font-semibold text-[#1B1F23]">{data.hoofRecords}</span>
                </div>
                <div className="flex justify-between gap-3 py-2.5 text-[13px]">
                  <span className="text-[#6B7280]">hoof_photos</span>
                  <span className="font-semibold text-[#1B1F23]">{data.hoofPhotos}</span>
                </div>
                <div className="flex justify-between gap-3 py-2.5 text-[13px]">
                  <span className="text-[#6B7280]">Tiere (horses)</span>
                  <span className="font-semibold text-[#1B1F23]">{data.horses}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className={adminCardClass}>
              <div className={adminSectionHeaderClass}>
                <i className="bi bi-person-plus-fill text-[15px] text-[#52b788]" aria-hidden />
                <h2 className="font-[family-name:var(--font-outfit)] text-[14px] font-semibold text-[#1B1F23]">
                  Neue Registrierungen
                </h2>
                <Link href="/admin/users" className="ml-auto text-[11px] font-semibold text-[#52b788] hover:underline">
                  Alle
                </Link>
              </div>
              <div className="divide-y divide-[#F0EEEA] px-5 py-2">
                {data.recentRegistrations.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 py-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgba(82,183,136,.08)] text-[12px] text-[#52b788]">
                      <i className="bi bi-person-fill" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-[#1B1F23]">{r.name}</div>
                      <div className="text-[11px] text-[#6B7280]">
                        {r.profession} · {billingBucketLabel(r.bucket)}
                      </div>
                    </div>
                    <div className="shrink-0 text-[10px] text-[#9CA3AF]">
                      {r.created_at ? formatGermanDateTime(r.created_at) : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={adminCardClass}>
              <div className={adminSectionHeaderClass}>
                <i className="bi bi-lightning-charge-fill text-[15px] text-[#F97316]" aria-hidden />
                <h2 className="font-[family-name:var(--font-outfit)] text-[14px] font-semibold text-[#1B1F23]">
                  Stripe Webhooks (Audit)
                </h2>
              </div>
              <div className="space-y-2 px-5 py-4">
                {data.webhookError ? (
                  <p className="text-[13px] text-[#6B7280]">Webhook-Tabelle: {data.webhookError}</p>
                ) : data.webhookRows.length === 0 ? (
                  <div className="space-y-2 text-[12px] leading-relaxed text-[#6B7280]">
                    <p>
                      Hier erscheinen nur <strong className="font-semibold text-[#475569]">eingehende Stripe-Webhooks</strong>{' '}
                      (POST auf eure App). Aktionen im Admin (z.&nbsp;B. „Trial beenden“) rufen die Stripe-API direkt auf — dafür
                      gibt es <strong className="font-semibold text-[#475569]">keinen Eintrag</strong> in dieser Liste.
                    </p>
                    <p>
                      Wenn dauerhaft nichts ankommt: In Stripe unter{' '}
                      <span className="font-medium text-[#334155]">Entwickler → Webhooks</span> muss die Endpoint-URL auf diese
                      App zeigen (Test- und Livemodus getrennt), und{' '}
                      <code className="rounded bg-[#F1F5F9] px-1 py-0.5 font-mono text-[11px]">STRIPE_WEBHOOK_SECRET</code> muss
                      zum Signing Secret des Endpoints passen.
                    </p>
                    {stripeWebhookUrl ? (
                      <p className="font-mono text-[11px] text-[#64748B] break-all">Erwartete URL: {stripeWebhookUrl}</p>
                    ) : null}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {data.webhookRows.map((w) => (
                      <li key={w.event_id} className="flex flex-wrap gap-2 text-[11px] text-[#6B7280]">
                        <span className="font-mono text-[#1B1F23]">{w.event_type}</span>
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
        </>
      ) : null}
    </div>
  )
}
