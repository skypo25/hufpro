'use client'

export default function ImpersonationBanner({
  targetEmail,
}: {
  targetEmail?: string | null
}) {
  return (
    <div className="sticky top-0 z-[60] border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-950">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3">
        <div>
          <strong className="font-semibold">Support-Ansicht aktiv.</strong>{' '}
          Du siehst die App als {targetEmail || 'dieser Nutzer'}. Änderungen wirken auf dessen Account.
        </div>
        <form action="/api/admin/impersonate/end" method="post">
          <button
            type="submit"
            className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-[12px] font-semibold text-amber-950 hover:bg-amber-100"
          >
            Ansicht beenden
          </button>
        </form>
      </div>
    </div>
  )
}
