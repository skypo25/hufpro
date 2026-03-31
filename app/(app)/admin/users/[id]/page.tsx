import Link from 'next/link'
import { notFound } from 'next/navigation'
import { billingBucketLabel, fetchAdminUserDetail } from '@/lib/admin/data'
import { formatGermanDate, formatGermanDateTime, formatStorageBytesShort } from '@/lib/format'
import { formatAdminLastActivity } from '@/lib/admin/lastActivity'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import { deleteUserAccount, endTrialNow, extendTrial, saveAdminUserNote, setUserBan, toggleAdminUserFlag } from './actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string; err?: string; msg?: string }>
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  )
}

function avatarColorFromId(id: string) {
  const hues = ['#52b788', '#3B82F6', '#8B5CF6', '#F97316', '#DC2626', '#B8860B', '#64748B']
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 7)) % 997
  return hues[h % hues.length]
}

function badgeClass(kind: 'green' | 'blue' | 'orange' | 'red' | 'gray') {
  switch (kind) {
    case 'green':
      return 'bg-[rgba(82,183,136,.08)] text-[#52b788]'
    case 'blue':
      return 'bg-[rgba(59,130,246,.08)] text-[#3B82F6]'
    case 'orange':
      return 'bg-[rgba(249,115,22,.08)] text-[#F97316]'
    case 'red':
      return 'bg-[rgba(220,38,38,.08)] text-[#DC2626]'
    default:
      return 'bg-[rgba(107,114,128,.08)] text-[#6B7280]'
  }
}

function DataRow(props: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-[#E5E2DC] py-3 last:border-b-0">
      <div className="text-[12px] text-[#6B7280]">{props.label}</div>
      <div className="min-w-0 text-right text-[13px] font-semibold text-[#1B1F23]">{props.value}</div>
    </div>
  )
}

export default async function AdminUserDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams

  let detail: Awaited<ReturnType<typeof fetchAdminUserDetail>> = null
  try {
    detail = await fetchAdminUserDetail(id)
  } catch {
    notFound()
  }
  if (!detail) notFound()

  const { user, name, profession, billing, billingBucket, counts, adminMeta, storageBytes } = detail as any
  const meta = user.user_metadata as { first_name?: string; last_name?: string } | undefined

  const purgePreview = await (async () => {
    try {
      const db = createSupabaseServiceRoleClient()
      const [
        customers,
        horses,
        appointments,
        appointmentHorses,
        hoofRecords,
        hoofPhotos,
        docRecords,
        docPhotos,
        invoices,
      ] = await Promise.all([
        db.from('customers').select('*', { count: 'exact', head: true }).eq('user_id', id),
        db.from('horses').select('*', { count: 'exact', head: true }).eq('user_id', id),
        db.from('appointments').select('*', { count: 'exact', head: true }).eq('user_id', id),
        db.from('appointment_horses').select('*', { count: 'exact', head: true }).eq('user_id', id),
        db.from('hoof_records').select('*', { count: 'exact', head: true }).eq('user_id', id),
        db.from('hoof_photos').select('*', { count: 'exact', head: true }).eq('user_id', id),
        db.from('documentation_records').select('*', { count: 'exact', head: true }).eq('user_id', id),
        db.from('documentation_photos').select('*', { count: 'exact', head: true }).eq('user_id', id),
        db.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', id),
      ])
      const safe = (r: any) => (typeof r?.count === 'number' ? r.count : 0)
      return {
        customers: safe(customers),
        horses: safe(horses),
        appointments: safe(appointments),
        appointmentHorses: safe(appointmentHorses),
        hoofRecords: safe(hoofRecords),
        hoofPhotos: safe(hoofPhotos),
        docRecords: safe(docRecords),
        docPhotos: safe(docPhotos),
        invoices: safe(invoices),
      }
    } catch {
      return null
    }
  })()

  const stripeCustomerUrl = billing?.stripe_customer_id
    ? `https://dashboard.stripe.com/customers/${billing.stripe_customer_id}`
    : null
  const stripeSubUrl = billing?.stripe_subscription_id
    ? `https://dashboard.stripe.com/subscriptions/${billing.stripe_subscription_id}`
    : null

  const initials = getInitials(name)
  const avatarBg = avatarColorFromId(user.id)
  const activity = formatAdminLastActivity(user.last_sign_in_at ?? null, new Date())
  const dotClass =
    activity.dot === 'online' ? 'bg-[#52b788]' : activity.dot === 'recent' ? 'bg-[#3B82F6]' : 'bg-[#E5E2DC]'

  const trialEnd = billing?.trial_ends_at ? new Date(billing.trial_ends_at) : null
  const trialHasEnd = !!trialEnd && !Number.isNaN(trialEnd.getTime())
  const now = new Date()
  const trialActive = trialHasEnd && (trialEnd as Date).getTime() > now.getTime()
  const trialExpired = trialHasEnd && !trialActive
  const trialDaysRemaining = trialActive
    ? Math.max(0, Math.ceil(((trialEnd as Date).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    : 0
  const trialTotalDays = 14
  const trialProgressPct = trialActive ? clamp(Math.round(((trialTotalDays - trialDaysRemaining) / trialTotalDays) * 100), 0, 100) : 100
  const trialStartGuess = trialHasEnd ? new Date((trialEnd as Date).getTime() - trialTotalDays * 24 * 60 * 60 * 1000) : null
  const trialStatusBadge = trialActive ? { label: 'Trial aktiv', kind: 'blue' as const, icon: 'bi-clock-fill' } : trialExpired ? { label: 'Trial abgelaufen', kind: 'orange' as const, icon: 'bi-clock-fill' } : null
  const flags = ((adminMeta?.feature_flags ?? {}) as Record<string, unknown>) || {}
  const note = (adminMeta?.admin_note ?? '') as string
  const noteUpdatedAt = adminMeta?.updated_at ? formatGermanDateTime(adminMeta.updated_at) : null

  return (
    <main className="mx-auto w-full max-w-[1280px] space-y-7 pb-12">
      <PageHeader
        title="Nutzerprofil"
        description="Admin · interne Detailansicht"
      />

      {sp.saved ? (
        <section className="huf-card border border-[rgba(82,183,136,.25)] bg-[rgba(82,183,136,.06)] px-[22px] py-4 text-[14px] text-[#154227]">
          <strong className="font-semibold">Gespeichert.</strong>{' '}
          {sp.saved === 'flag'
            ? 'Feature-Flag aktualisiert.'
            : sp.saved === 'note'
              ? 'Notiz gespeichert.'
              : sp.saved === 'trial'
                ? 'Trial verlängert.'
                : sp.saved === 'trial_end'
                  ? 'Trial beendet.'
                  : sp.saved === 'ban'
                    ? 'Account deaktiviert.'
                    : sp.saved === 'unban'
                      ? 'Account wieder aktiviert.'
                  : 'Aktualisierung durchgeführt.'}
        </section>
      ) : null}
      {sp.err ? (
        <section className="huf-card border border-red-200 bg-red-50 px-[22px] py-4 text-[14px] text-red-900">
          <strong className="font-semibold">Fehler.</strong>{' '}
          {sp.err === 'flag'
            ? 'Feature-Flag konnte nicht gespeichert werden.'
            : sp.err === 'note'
              ? 'Notiz konnte nicht gespeichert werden.'
              : sp.err === 'trial'
                ? 'Trial konnte nicht aktualisiert werden.'
                : sp.err === 'ban'
                  ? 'Account konnte nicht geändert werden.'
                  : sp.err === 'delete'
                    ? 'Account konnte nicht gelöscht werden.'
                : 'Aktion fehlgeschlagen.'}
          {sp.msg ? <div className="mt-1 text-[13px] text-red-900/80">{sp.msg}</div> : null}
        </section>
      ) : null}

      <Link
        href="/admin/users"
        className="inline-flex w-fit items-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5 text-[14px] font-medium text-[#1B1F23] hover:border-[#52b788]"
      >
        <i className="bi bi-arrow-left" aria-hidden />
        Zurück zur Nutzerliste
      </Link>

      {/* HERO */}
      <section className="huf-card">
        <div className="flex flex-col gap-4 px-[22px] py-[18px] md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div
              className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-2xl text-[20px] font-semibold text-white"
              style={{ background: avatarBg }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <div className="dashboard-serif truncate text-[26px] font-medium tracking-[-0.02em] text-[#1B1F23]">
                {name}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[14px] text-[#6B7280]">
                <i className="bi bi-envelope-fill text-[13px] text-[#9CA3AF]" aria-hidden />
                <span className="truncate">{user.email ?? '—'}</span>
                <span className="text-[#E5E2DC]">·</span>
                <i className="bi bi-hash text-[13px] text-[#9CA3AF]" aria-hidden />
                <span className="font-[tabular-nums] text-[13px] text-[#6B7280]">USR-{user.id.slice(0, 8)}</span>
                <span className="text-[#E5E2DC]">·</span>
                <i className="bi bi-calendar-fill text-[13px] text-[#9CA3AF]" aria-hidden />
                <span>
                  Registriert {user.created_at ? formatGermanDate(user.created_at) : '—'}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {trialStatusBadge ? (
                  <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium ${badgeClass(trialStatusBadge.kind)}`}>
                    <i className={`bi ${trialStatusBadge.icon} text-[11px]`} aria-hidden />
                    {trialStatusBadge.label}
                  </span>
                ) : null}
                <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium ${badgeClass('gray')}`}>
                  <i className="bi bi-tag-fill text-[11px]" aria-hidden />
                  {profession}
                </span>
                <span className={`inline-flex items-center gap-2 rounded-md px-2 py-1 text-[12px] font-medium ${badgeClass('gray')}`}>
                  <span className={`h-[7px] w-[7px] rounded-full ${dotClass}`} />
                  {activity.text}
                </span>
                <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium ${badgeClass('green')}`}>
                  <i className="bi bi-people-fill text-[11px]" aria-hidden />
                  {billingBucketLabel(billingBucket)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {user.email ? (
              <a
                href={`mailto:${user.email}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5 text-[14px] font-medium text-[#1B1F23] hover:border-[#52b788]"
              >
                <i className="bi bi-envelope-fill" aria-hidden />
                E-Mail
              </a>
            ) : null}
            <button
              type="button"
              disabled
              title="Impersonation ist noch nicht angebunden"
              className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5 text-[14px] font-medium text-[#9CA3AF] opacity-70"
            >
              <i className="bi bi-box-arrow-up-right" aria-hidden />
              Als Nutzer ansehen
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* LEFT */}
        <div className="space-y-4 lg:col-span-2">
          {/* TRIAL */}
          <SectionCard
            title="Testphase"
            right={
              trialActive ? (
                <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium ${badgeClass('blue')}`}>
                  <i className="bi bi-clock-fill text-[11px]" aria-hidden />
                  Aktiv
                </span>
              ) : trialExpired ? (
                <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium ${badgeClass('orange')}`}>
                  <i className="bi bi-clock-fill text-[11px]" aria-hidden />
                  Abgelaufen
                </span>
              ) : (
                <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium ${badgeClass('gray')}`}>
                  —
                </span>
              )
            }
            bodyClassName="px-[22px] py-[18px]"
          >
            <div className="rounded-xl border border-[rgba(59,130,246,.14)] bg-[rgba(59,130,246,.06)] p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex items-center gap-2 text-[14px] font-semibold text-[#3B82F6]">
                  <i className="bi bi-hourglass-split text-[16px]" aria-hidden />
                  Trial-Countdown
                </div>
                <div className="text-[22px] font-semibold text-[#3B82F6]">
                  {trialActive ? `${trialDaysRemaining} Tage übrig` : trialExpired ? '0 Tage übrig' : '—'}
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded bg-[rgba(59,130,246,.14)]">
                <div className="h-full rounded bg-[#3B82F6]" style={{ width: `${trialProgressPct}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-[12px] text-[#6B7280]">
                <span>Start: {trialStartGuess ? formatGermanDate(trialStartGuess.toISOString()) : '—'}</span>
                <span>Ende: {trialHasEnd ? formatGermanDate((trialEnd as Date).toISOString()) : '—'}</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <form action={extendTrial.bind(null, user.id)} className="flex items-center gap-2">
                  <select
                    name="days"
                    defaultValue="7"
                    className="rounded-lg border border-[rgba(59,130,246,.25)] bg-white px-3 py-2 text-[13px] font-medium text-[#3B82F6] outline-none"
                  >
                    <option value="7">+7 Tage</option>
                    <option value="14">+14 Tage</option>
                    <option value="30">+30 Tage</option>
                  </select>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-lg bg-[#3B82F6] px-3 py-2 text-[13px] font-medium text-white hover:bg-[#2563EB]"
                  >
                    <i className="bi bi-plus-circle" aria-hidden />
                    Verlängern
                  </button>
                </form>
                <form action={endTrialNow.bind(null, user.id)}>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-lg border border-[rgba(184,134,11,.25)] bg-white px-3 py-2 text-[13px] font-medium text-[#B8860B] hover:bg-[rgba(184,134,11,.08)]"
                  >
                    <i className="bi bi-x-circle-fill" aria-hidden />
                    Trial beenden
                  </button>
                </form>
              </div>
            </div>

            <div className="mt-4">
              <DataRow label="Trial-Start" value={trialStartGuess ? formatGermanDate(trialStartGuess.toISOString()) : '—'} />
              <DataRow
                label="Trial-Ende (geplant)"
                value={
                  trialHasEnd ? (
                    <span className="text-[#3B82F6]">{formatGermanDateTime((trialEnd as Date).toISOString())}</span>
                  ) : (
                    '—'
                  )
                }
              />
              <DataRow label="Zahlungsmethode hinterlegt" value={billing?.billing_email ? 'Ja' : 'Nein'} />
            </div>
          </SectionCard>

          {/* BILLING */}
          <SectionCard
            title="Billing & Stripe"
            right={
              stripeCustomerUrl ? (
                <a href={stripeCustomerUrl} target="_blank" rel="noreferrer" className="text-[13px] font-semibold text-[#52b788] hover:underline">
                  Stripe Dashboard →
                </a>
              ) : (
                <span className="text-[12px] text-[#9CA3AF]">—</span>
              )
            }
            bodyClassName="px-[22px] py-[18px]"
          >
            <DataRow label="Abo-Status" value={billing?.subscription_status ?? '—'} />
            <DataRow label="Plan" value="AniDocs Professional · 39,95 €/Monat" />
            <DataRow
              label="Stripe Customer ID"
              value={
                billing?.stripe_customer_id ? (
                  stripeCustomerUrl ? (
                    <a className="font-mono text-[12px] text-[#52b788] hover:underline" href={stripeCustomerUrl} target="_blank" rel="noreferrer">
                      {billing.stripe_customer_id}
                    </a>
                  ) : (
                    <span className="font-mono text-[12px]">{billing.stripe_customer_id}</span>
                  )
                ) : (
                  <span className="text-[#9CA3AF]">—</span>
                )
              }
            />
            <DataRow
              label="Subscription ID"
              value={
                billing?.stripe_subscription_id && stripeSubUrl ? (
                  <a className="font-mono text-[12px] text-[#52b788] hover:underline" href={stripeSubUrl} target="_blank" rel="noreferrer">
                    {billing.stripe_subscription_id}
                  </a>
                ) : (
                  <span className="text-[#9CA3AF]">Noch kein Abo</span>
                )
              }
            />
            <DataRow label="Billing E-Mail" value={billing?.billing_email ?? <span className="text-[#9CA3AF]">Nicht hinterlegt</span>} />
            <DataRow
              label="Abo-Periode bis"
              value={
                billing?.subscription_current_period_end ? formatGermanDateTime(billing.subscription_current_period_end) : '—'
              }
            />
            <DataRow
              label="Letztes Stripe-Event"
              value={billing?.last_stripe_event_at ? formatGermanDateTime(billing.last_stripe_event_at) : '—'}
            />
          </SectionCard>

          {/* PROFILE */}
          <SectionCard title="Profil & Stammdaten" bodyClassName="px-[22px] py-[18px]">
            <DataRow label="Name" value={name} />
            <DataRow
              label="E-Mail"
              value={
                user.email ? (
                  <a className="text-[#52b788] hover:underline" href={`mailto:${user.email}`}>
                    {user.email}
                  </a>
                ) : (
                  '—'
                )
              }
            />
            <DataRow label="Berufsgruppe" value={<span className={`inline-flex rounded-md px-2 py-1 text-[12px] font-medium ${badgeClass('orange')}`}>{profession}</span>} />
            <DataRow label="Auth Meta" value={meta?.first_name || meta?.last_name ? `${meta?.first_name ?? ''} ${meta?.last_name ?? ''}`.trim() : '—'} />
            <DataRow label="Registriert am" value={user.created_at ? formatGermanDateTime(user.created_at) : '—'} />
            <DataRow label="Letzter Login" value={user.last_sign_in_at ? formatGermanDateTime(user.last_sign_in_at) : '—'} />
          </SectionCard>

          {/* USAGE */}
          <SectionCard title="Nutzungsdaten" right={<span className="text-[12px] text-[#9CA3AF]">Seit Registrierung</span>} bodyClassName="px-[22px] py-[18px]">
            <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
              <DataRow label="Tiere angelegt" value={counts.horses} />
              <DataRow label="Kunden angelegt" value={counts.customers} />
              <DataRow label="Dokumentationen" value={counts.documentationRecords} />
              <DataRow label="Fotos hochgeladen" value={counts.hoofPhotos} />
              <DataRow label="Huf-Records" value={counts.hoofRecords} />
              <DataRow label="Rechnungen erstellt" value={counts.invoices} />
            </div>
          </SectionCard>

          {/* STORAGE (placeholder bytes) */}
          <SectionCard title="Speichernutzung" bodyClassName="px-[22px] py-[18px]">
            <div className="space-y-3">
              <StorageBar label="Fotos" tone="green" valueLabel={`${counts.hoofPhotos} Dateien`} pct={0} />
              <StorageBar label="Dokumentations-Fotos" tone="purple" valueLabel="inkl." pct={0} />
              <StorageBar label="Gesamt (Bytes)" tone="blue" valueLabel={formatStorageBytesShort(typeof storageBytes === 'number' ? storageBytes : 0)} pct={0} />
              <div className="mt-2 flex items-center justify-between border-t border-[#E5E2DC] pt-3 text-[14px]">
                <span className="text-[#6B7280]">Gesamt</span>
                <span className="font-semibold text-[#1B1F23]">{formatStorageBytesShort(typeof storageBytes === 'number' ? storageBytes : 0)}</span>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* RIGHT */}
        <div className="space-y-4">
          <SectionCard title="Schnellaktionen" bodyClassName="px-[22px] py-[18px]">
            <div className="flex flex-col gap-2">
              {user.email ? (
                <a
                  href={`mailto:${user.email}`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5 text-[14px] font-medium text-[#1B1F23] hover:border-[#52b788]"
                >
                  <i className="bi bi-envelope-fill" aria-hidden />
                  E-Mail senden
                </a>
              ) : null}
              <button
                disabled
                title="Password-Reset Link folgt als nächster Schritt"
                className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5 text-[14px] font-medium text-[#9CA3AF] opacity-70"
              >
                <i className="bi bi-key-fill" aria-hidden />
                Passwort-Reset
              </button>
              {stripeCustomerUrl ? (
                <a
                  href={stripeCustomerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5 text-[14px] font-medium text-[#1B1F23] hover:border-[#52b788]"
                >
                  <i className="bi bi-box-arrow-up-right" aria-hidden />
                  Stripe
                </a>
              ) : null}
              <button
                disabled
                title="Impersonation folgt als nächster Schritt"
                className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5 text-[14px] font-medium text-[#9CA3AF] opacity-70"
              >
                <i className="bi bi-person-badge-fill" aria-hidden />
                Als Nutzer einloggen
              </button>
            </div>
          </SectionCard>

          <SectionCard title="Feature-Flags" bodyClassName="px-[22px] py-[18px]">
            <div className="space-y-3">
              <FlagRow userId={user.id} flag="ai_assistant" title="KI-Textassistent" desc="Voice-to-Text und KI-Verbesserung" on={flags.ai_assistant === true} />
              <FlagRow userId={user.id} flag="photo_compare" title="Fotovergleich" desc="Vorher/Nachher-Vergleich" on={flags.photo_compare === true} />
              <FlagRow userId={user.id} flag="invoices" title="Rechnungsmodul" desc="Rechnungserstellung und -versand" on={flags.invoices === true} />
              <FlagRow userId={user.id} flag="beta" title="Beta-Features" desc="Zugang zu unveröffentlichten Funktionen" on={flags.beta === true} />
            </div>
          </SectionCard>

          <SectionCard title="Interne Notizen" bodyClassName="px-[22px] py-[18px]">
            <form action={saveAdminUserNote.bind(null, user.id)}>
              <textarea
                name="admin_note"
                defaultValue={note}
                className="min-h-[120px] w-full resize-y rounded-lg border border-[#E5E2DC] bg-[rgba(0,0,0,0.02)] px-4 py-3 text-[14px] text-[#1B1F23] outline-none focus:border-[#52b788] focus:bg-white"
                placeholder="Interne Notizen zu diesem Nutzer…"
              />
              <div className="mt-2 text-[12px] text-[#9CA3AF]">
                Nur für Admins sichtbar{noteUpdatedAt ? ` · Zuletzt bearbeitet: ${noteUpdatedAt}` : ''}.
              </div>
              <button
                type="submit"
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#52b788] px-4 py-2.5 text-[14px] font-medium text-white hover:bg-[#0f301b]"
              >
                <i className="bi bi-check-lg" aria-hidden />
                Notiz speichern
              </button>
            </form>
          </SectionCard>

          <SectionCard title="Aktivitäts-Log" right={<span className="text-[12px] text-[#9CA3AF]">letzte Events</span>} bodyClassName="px-[22px] py-[18px]">
            <LogItem time={user.last_sign_in_at ? formatGermanDateTime(user.last_sign_in_at) : '—'} kind="LOGIN" tone="blue" msg="Letzter Login (Auth)" />
            <LogItem time={user.created_at ? formatGermanDateTime(user.created_at) : '—'} kind="SYSTEM" tone="gray" msg="Account erstellt" />
            <LogItem time={billing?.last_stripe_event_at ? formatGermanDateTime(billing.last_stripe_event_at) : '—'} kind="BILLING" tone="pink" msg="Letztes Stripe-Event" />
          </SectionCard>

          <section className="huf-card border border-[rgba(220,38,38,.15)] bg-[rgba(220,38,38,.012)] px-[22px] py-[18px]">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-[#DC2626]">
              <i className="bi bi-exclamation-triangle-fill" aria-hidden />
              Kritische Aktionen
            </div>
            <div className="mt-2 text-[14px] leading-relaxed text-[#6B7280]">
              Änderungen wirken sofort auf Login / Zugriff. Aktionen werden im Admin-Audit-Log protokolliert.
            </div>
            <div className="mt-4 rounded-xl border border-[rgba(220,38,38,.18)] bg-white p-4">
              <div className="text-[13px] font-semibold text-[#1B1F23]">Hard Delete (GDPR) – Vorschau</div>
              <div className="mt-1 text-[12px] text-[#6B7280]">
                Das löscht App-Daten + Storage-Dateien und entfernt danach den Auth-User. Diese Aktion ist nicht rückgängig zu machen.
              </div>
              {purgePreview ? (
                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[12px] text-[#374151]">
                  <div className="flex items-center justify-between gap-3"><span>Kunden</span><span className="font-semibold text-[#1B1F23]">{purgePreview.customers}</span></div>
                  <div className="flex items-center justify-between gap-3"><span>Tiere</span><span className="font-semibold text-[#1B1F23]">{purgePreview.horses}</span></div>
                  <div className="flex items-center justify-between gap-3"><span>Termine</span><span className="font-semibold text-[#1B1F23]">{purgePreview.appointments}</span></div>
                  <div className="flex items-center justify-between gap-3"><span>Termin↔Tier</span><span className="font-semibold text-[#1B1F23]">{purgePreview.appointmentHorses}</span></div>
                  <div className="flex items-center justify-between gap-3"><span>Huf-Records</span><span className="font-semibold text-[#1B1F23]">{purgePreview.hoofRecords}</span></div>
                  <div className="flex items-center justify-between gap-3"><span>Huf-Fotos (DB)</span><span className="font-semibold text-[#1B1F23]">{purgePreview.hoofPhotos}</span></div>
                  <div className="flex items-center justify-between gap-3"><span>Dokumentationen</span><span className="font-semibold text-[#1B1F23]">{purgePreview.docRecords}</span></div>
                  <div className="flex items-center justify-between gap-3"><span>Doku-Fotos (DB)</span><span className="font-semibold text-[#1B1F23]">{purgePreview.docPhotos}</span></div>
                  <div className="flex items-center justify-between gap-3"><span>Rechnungen</span><span className="font-semibold text-[#1B1F23]">{purgePreview.invoices}</span></div>
                  <div className="flex items-center justify-between gap-3"><span>Storage bytes</span><span className="font-semibold text-[#1B1F23]">{formatStorageBytesShort(typeof storageBytes === 'number' ? storageBytes : 0)}</span></div>
                </div>
              ) : (
                <div className="mt-3 text-[12px] text-[#9CA3AF]">Vorschau konnte nicht geladen werden.</div>
              )}
              <div className="mt-3 rounded-lg bg-[rgba(220,38,38,.06)] px-3 py-2 text-[12px] text-[#7F1D1D]">
                <strong className="font-semibold">Bestätigung erforderlich:</strong> Checkbox setzen und die User-ID exakt eingeben.
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <form action={setUserBan.bind(null, user.id)}>
                <input type="hidden" name="mode" value="ban" />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[rgba(184,134,11,.25)] bg-white px-4 py-2.5 text-[14px] font-medium text-[#B8860B] hover:bg-[rgba(184,134,11,.08)]"
                >
                  <i className="bi bi-person-slash" aria-hidden />
                  Account deaktivieren
                </button>
              </form>
              <form action={setUserBan.bind(null, user.id)}>
                <input type="hidden" name="mode" value="unban" />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5 text-[14px] font-medium text-[#1B1F23] hover:border-[#52b788]"
                >
                  <i className="bi bi-person-check" aria-hidden />
                  Account aktivieren
                </button>
              </form>
              <form action={deleteUserAccount.bind(null, user.id)} className="rounded-xl border border-[rgba(220,38,38,.18)] bg-white p-3">
                <label className="flex items-start gap-3 text-[13px] text-[#374151]">
                  <input name="confirm_check" type="checkbox" className="mt-1 h-4 w-4 accent-[#DC2626]" />
                  <span>
                    Ich verstehe, dass diese Aktion <strong className="font-semibold">nicht rückgängig</strong> gemacht werden kann.
                  </span>
                </label>
                <div className="mt-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF]">User-ID zur Bestätigung</div>
                  <input
                    name="confirm"
                    placeholder={user.id}
                    className="mt-1 w-full rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[13px] font-mono text-[#1B1F23] outline-none focus:border-[#DC2626]"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[rgba(220,38,38,.25)] bg-white px-4 py-2.5 text-[14px] font-medium text-[#DC2626] hover:bg-[rgba(220,38,38,.08)]"
                >
                  <i className="bi bi-trash3-fill" aria-hidden />
                  Account endgültig löschen
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

function StorageBar(props: { label: string; valueLabel: string; pct: number; tone: 'green' | 'blue' | 'purple' | 'orange' }) {
  const fill =
    props.tone === 'green'
      ? 'bg-[#52b788]'
      : props.tone === 'blue'
        ? 'bg-[#3B82F6]'
        : props.tone === 'purple'
          ? 'bg-[#8B5CF6]'
          : 'bg-[#F97316]'
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-[110px] text-[13px] text-[#6B7280]">{props.label}</div>
      <div className="h-2 flex-1 overflow-hidden rounded bg-[#F0EEEA]">
        <div className={`h-full rounded ${fill}`} style={{ width: `${clamp(props.pct, 0, 100)}%` }} />
      </div>
      <div className="min-w-[90px] text-right text-[13px] font-semibold text-[#1B1F23]">{props.valueLabel}</div>
    </div>
  )
}

function FlagRow(props: { userId: string; flag: string; title: string; desc: string; on: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#E5E2DC] pb-3 last:border-b-0 last:pb-0">
      <div>
        <div className="text-[14px] font-medium text-[#1B1F23]">{props.title}</div>
        <div className="mt-0.5 text-[12px] text-[#6B7280]">{props.desc}</div>
      </div>
      <form action={toggleAdminUserFlag.bind(null, props.userId)} className="shrink-0">
        <input type="hidden" name="flag" value={props.flag} />
        <button
          type="submit"
          className={[
            'h-[22px] w-[44px] rounded-full border border-[#E5E2DC] transition',
            props.on ? 'bg-[#52b788]' : 'bg-[#D1D5DB]',
          ].join(' ')}
          title={props.on ? 'Deaktivieren' : 'Aktivieren'}
          aria-label={`${props.title} ${props.on ? 'deaktivieren' : 'aktivieren'}`}
        >
          <span
            className={[
              'block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition',
              props.on ? 'translate-x-[22px]' : 'translate-x-[2px]',
            ].join(' ')}
          />
        </button>
      </form>
    </div>
  )
}

function LogItem(props: { time: string; kind: string; msg: string; tone: 'blue' | 'green' | 'purple' | 'orange' | 'pink' | 'gray' }) {
  const tone =
    props.tone === 'blue'
      ? 'bg-[rgba(59,130,246,.08)] text-[#3B82F6]'
      : props.tone === 'green'
        ? 'bg-[rgba(82,183,136,.08)] text-[#52b788]'
        : props.tone === 'purple'
          ? 'bg-[rgba(139,92,246,.08)] text-[#8B5CF6]'
          : props.tone === 'orange'
            ? 'bg-[rgba(249,115,22,.08)] text-[#F97316]'
            : props.tone === 'pink'
              ? 'bg-[rgba(236,72,153,.08)] text-[#EC4899]'
              : 'bg-[rgba(107,114,128,.08)] text-[#6B7280]'
  return (
    <div className="flex items-start gap-3 border-b border-[#E5E2DC] py-2 last:border-b-0">
      <div className="min-w-[130px] font-[tabular-nums] text-[12px] text-[#9CA3AF]">{props.time}</div>
      <div className={`min-w-[70px] rounded px-2 py-1 text-center text-[11px] font-semibold ${tone}`}>{props.kind}</div>
      <div className="min-w-0 flex-1 text-[13px] text-[#6B7280]">{props.msg}</div>
    </div>
  )
}
