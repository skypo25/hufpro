'use client'

type InvoicesListSearchFormProps = {
  q: string
  status: string
}

export default function InvoicesListSearchForm({ q, status }: InvoicesListSearchFormProps) {
  return (
    <form method="get" className="flex flex-wrap items-center gap-3">
      <label className="flex flex-1 min-w-[200px] items-center gap-2 rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-[#52b788]/30">
        <span className="text-[#6B7280]">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </span>
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Suchen nach Kundendaten, Rechnungsnummer, Kundennummer…"
          className="min-w-0 flex-1 border-0 bg-transparent text-[14px] text-[#1B1F23] placeholder:text-[#9CA3AF] focus:outline-none"
        />
      </label>
      <select
        name="status"
        defaultValue={status}
        className="h-[42px] rounded-lg border border-[#E5E2DC] bg-white px-3 py-2 text-[14px] text-[#1B1F23] focus:ring-2 focus:ring-[#52b788]/30 focus:outline-none"
      >
        <option value="all">Alle</option>
        <option value="open">Offene Rechnungen</option>
        <option value="paid">Bezahlte Rechnungen</option>
      </select>
      <button
        type="submit"
        className="huf-btn-dark rounded-lg bg-[#52b788] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#0f301b]"
      >
        Suchen
      </button>
    </form>
  )
}
