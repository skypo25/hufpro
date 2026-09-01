'use client'

import Link from 'next/link'

export default function OfflinePage() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-[#1b1f23] px-6"
      style={{ fontFamily: 'var(--font-outfit, "Outfit", sans-serif)' }}
    >
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#2d3339] text-4xl">
        📡
      </div>
      <h1 className="mb-3 text-center text-2xl font-semibold text-white">
        Keine Internetverbindung
      </h1>
      <p className="mb-8 max-w-[320px] text-center text-[15px] leading-relaxed text-[#9ca3af]">
        Du bist offline. Einige Seiten und Daten sind möglicherweise nicht verfügbar.
        Sobald du wieder online bist, kannst du normal weiterarbeiten.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="primary-button primary-button--lg font-semibold"
      >
        Erneut versuchen
      </button>
      <Link
        href="/dashboard"
        className="mt-4 text-[14px] text-primary hover:underline"
      >
        Zum Dashboard
      </Link>
    </div>
  )
}
