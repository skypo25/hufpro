export default function InvoicesLoading() {
  return (
    <div className="w-full animate-pulse space-y-6" aria-busy="true" aria-label="Rechnungen werden geladen">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-44 rounded-lg bg-[#E8E6E2]" />
          <div className="h-4 w-56 rounded-md bg-[#EFEDE8]" />
        </div>
        <div className="h-10 w-40 rounded-lg bg-[#EFEDE8]" />
      </div>
      <div className="h-12 rounded-xl border border-[#E5E2DC] bg-white/80" />
      <div className="overflow-hidden rounded-xl border border-[#E5E2DC] bg-white">
        <div className="border-b border-[#E5E2DC] bg-[rgba(0,0,0,0.02)] px-5 py-4">
          <div className="h-3 w-48 rounded bg-[#E8E6E2]" />
        </div>
        <div className="space-y-0 divide-y divide-[#F0EEEA]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-1/4 rounded bg-[#E8E6E2]" />
                <div className="h-3 w-1/3 rounded bg-[#EFEDE8]" />
              </div>
              <div className="h-6 w-20 rounded-full bg-[#EFEDE8]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
