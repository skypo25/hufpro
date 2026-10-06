export default function AppLoading() {
  return (
    <div className="w-full animate-pulse space-y-6" aria-busy="true" aria-label="Seite wird geladen">
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-lg bg-[#E8E6E2]" />
        <div className="h-4 w-72 max-w-full rounded-md bg-[#EFEDE8]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="h-28 rounded-xl border border-[#E5E2DC] bg-white/80" />
        <div className="h-28 rounded-xl border border-[#E5E2DC] bg-white/80" />
        <div className="h-28 rounded-xl border border-[#E5E2DC] bg-white/80 sm:col-span-2 xl:col-span-1" />
      </div>
      <div className="overflow-hidden rounded-xl border border-[#E5E2DC] bg-white">
        <div className="border-b border-[#E5E2DC] bg-[rgba(0,0,0,0.02)] px-5 py-4">
          <div className="h-3 w-40 rounded bg-[#E8E6E2]" />
        </div>
        <div className="space-y-0 divide-y divide-[#F0EEEA]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="h-9 w-9 shrink-0 rounded-full bg-[#EFEDE8]" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-1/3 rounded bg-[#E8E6E2]" />
                <div className="h-3 w-1/2 rounded bg-[#EFEDE8]" />
              </div>
              <div className="h-3 w-16 rounded bg-[#EFEDE8]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
