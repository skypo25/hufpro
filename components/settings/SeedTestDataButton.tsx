'use client'

import { useState } from 'react'

type SeedResult = {
  ok?: boolean
  message?: string
  customers?: number
  horses?: number
  appointments?: number
  hoofRecords?: number
  invoices?: number
  error?: string
  partial?: SeedResult
}

export default function SeedTestDataButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SeedResult | null>(null)

  async function handleSeed() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      const data: SeedResult = await res.json().catch(() => ({}))
      setResult(data)
      if (res.ok && data.ok) {
        window.location.reload()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#E5E2DC] bg-[#FAF9F7] p-5">
      <h3 className="font-semibold text-[#1B1F23]">Testdaten</h3>
      <p className="mt-1 text-sm text-[#6B7280]">
        15 Kunden, ca. 20–25 Pferde, Termine (letzte 6 Monate + nächste 2 Wochen), Hufdokumentationen und einige Rechnungen. Keine Fotos.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSeed}
          disabled={loading}
          className="huf-btn-dark rounded-lg bg-[#154226] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0f301b] disabled:opacity-60"
        >
          {loading ? 'Wird angelegt…' : 'Testdaten laden'}
        </button>
        {result && (
          <span className="text-sm text-[#6B7280]">
            {result.error ? (
              <span className="text-red-600">{result.error}</span>
            ) : result.ok ? (
              <>
                {result.customers} Kunden, {result.horses} Pferde, {result.appointments} Termine, {result.hoofRecords} Dokumentationen, {result.invoices} Rechnungen.
              </>
            ) : null}
          </span>
        )}
      </div>
    </div>
  )
}
