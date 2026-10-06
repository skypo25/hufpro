export default function CustomerDetailLoading() {
  return (
    <div className="w-full animate-pulse space-y-6" aria-busy="true" aria-label="Kunde wird geladen">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-5">
          <div className="h-16 w-16 shrink-0 rounded-full bg-[#E8E6E2]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-7 w-52 max-w-full rounded-lg bg-[#E8E6E2]" />
            <div className="h-4 w-72 max-w-full rounded-md bg-[#EFEDE8]" />
          </div>
        </div>
        <div className="flex gap-2.5">
          <div className="h-10 w-28 rounded-lg bg-[#EFEDE8]" />
          <div className="h-10 w-36 rounded-lg bg-[#EFEDE8]" />
        </div>
      </div>

      <div className="flex gap-0 border-b-2 border-[#E5E2DC]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-5 py-3">
            <div className="h-4 w-20 rounded bg-[#EFEDE8]" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl border border-[#E5E2DC] bg-white/80" />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-64 rounded-xl border border-[#E5E2DC] bg-white/80" />
        <div className="h-64 rounded-xl border border-[#E5E2DC] bg-white/80" />
      </div>
    </div>
  )
}
