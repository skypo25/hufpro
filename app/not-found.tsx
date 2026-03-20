import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[var(--background)]">
      {/* Decorative background */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        aria-hidden
      >
        <div
          className="absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-[0.07]"
          style={{ background: 'var(--accent)' }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-[0.05]"
          style={{ background: 'var(--accent)' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-[var(--accent)] opacity-[0.03]"
          style={{ borderWidth: 1 }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-md">
        {/* 404 number */}
        <div
          className="text-[clamp(6rem,20vw,10rem)] font-[800] leading-none tracking-tighter text-[var(--accent)] opacity-20 select-none"
          style={{ fontFamily: 'var(--font-outfit)' }}
        >
          404
        </div>

        {/* Icon */}
        <div
          className="flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
          style={{ background: 'var(--accent-light)' }}
        >
          <i className="bi bi-signpost-split text-3xl text-[var(--accent)]" />
        </div>

        <h1
          className="text-2xl font-semibold text-[var(--foreground)] mb-2"
          style={{ fontFamily: 'var(--font-outfit)' }}
        >
          Seite nicht gefunden
        </h1>
        <p className="text-[15px] text-[var(--text-secondary)] mb-8 leading-relaxed">
          Die angeforderte Seite existiert nicht oder wurde verschoben.
        </p>

        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-medium transition-all hover:opacity-90 active:scale-[0.98]"
          style={{
            background: 'var(--accent)',
            color: '#ffffff',
            fontFamily: 'var(--font-outfit)',
            boxShadow: '0 4px 14px rgba(82, 183, 136, 0.35)',
          }}
        >
          <i className="bi bi-house-door-fill text-lg" style={{ color: '#ffffff' }} />
          Zur Startseite
        </Link>
      </div>
    </div>
  )
}
