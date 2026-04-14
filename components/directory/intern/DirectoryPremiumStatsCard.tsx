import type { DirectoryOwnerPremiumStats } from '@/lib/directory/stats/fetchDirectoryOwnerPremiumStats.server'

function StatBox({
  label,
  value,
  hint,
}: {
  label: string
  value: number
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 font-serif text-[26px] font-medium tabular-nums tracking-tight text-[#1B1F23]">
        {value.toLocaleString('de-DE')}
      </div>
      {hint ? <div className="mt-1 text-[11px] leading-snug text-slate-500">{hint}</div> : null}
    </div>
  )
}

export function DirectoryPremiumStatsCard({ stats }: { stats: DirectoryOwnerPremiumStats }) {
  return (
    <div className="rounded-2xl border border-emerald-100/90 bg-gradient-to-br from-emerald-50/50 to-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-[#1B1F23]">Statistik (Top-Profil)</h2>
          <p className="mt-0.5 text-[12px] text-slate-600">
            Überblick über Aufrufe der öffentlichen Profilseite und Kontaktanfragen über das Formular.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatBox
          label="Profilaufrufe (geschätzt)"
          value={stats.profileViewsTotal}
          hint="Ein Aufruf pro Browser-Sitzung, wenn die öffentliche Seite geladen wird (ohne Suchmaschinen-Bots)."
        />
        <StatBox label="Kontaktanfragen (7 Tage)" value={stats.contactInquiriesLast7Days} />
        <StatBox label="Kontaktanfragen (30 Tage)" value={stats.contactInquiriesLast30Days} />
        <StatBox label="Kontaktanfragen (gesamt)" value={stats.contactInquiriesTotal} />
      </div>
    </div>
  )
}
