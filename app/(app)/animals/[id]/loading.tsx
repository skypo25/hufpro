export default function AnimalDetailLoading() {
  return (
    <div className="w-full animate-pulse space-y-6" aria-busy="true" aria-label="Tier wird geladen">
      <div className="flex items-center gap-5">
        <div className="h-[72px] w-[72px] shrink-0 rounded-2xl bg-[#E8E6E2]" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-8 w-48 max-w-full rounded-lg bg-[#E8E6E2]" />
          <div className="h-4 w-64 max-w-full rounded-md bg-[#EFEDE8]" />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="h-10 w-28 rounded-lg bg-[#EFEDE8]" />
        <div className="h-10 w-36 rounded-lg bg-[#EFEDE8]" />
        <div className="h-10 w-32 rounded-lg bg-[#EFEDE8]" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-xl border border-[#E5E2DC] bg-white">
            <div className="border-b border-[#E5E2DC] px-5 py-4">
              <div className="h-4 w-32 rounded bg-[#E8E6E2]" />
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-20 rounded bg-[#EFEDE8]" />
                  <div className="h-4 w-28 rounded bg-[#E8E6E2]" />
                </div>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-[#E5E2DC] bg-white">
            <div className="border-b border-[#E5E2DC] px-5 py-4">
              <div className="h-4 w-40 rounded bg-[#E8E6E2]" />
            </div>
            <div className="space-y-0 divide-y divide-[#F0EEEA]">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3.5 w-1/3 rounded bg-[#E8E6E2]" />
                    <div className="h-3 w-1/4 rounded bg-[#EFEDE8]" />
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-[#EFEDE8]" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="h-40 rounded-xl border border-[#E5E2DC] bg-white/80" />
          <div className="h-48 rounded-xl border border-[#E5E2DC] bg-white/80" />
        </div>
      </div>
    </div>
  )
}
