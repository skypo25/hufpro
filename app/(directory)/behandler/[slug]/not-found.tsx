import Link from 'next/link'

export default function BehandlerProfileNotFound() {
  return (
    <div className="rounded-[var(--radius-app)] border border-border bg-card px-6 py-12 text-center">
      <h1 className="text-xl font-semibold text-foreground">Eintrag nicht gefunden</h1>
      <p className="mt-2 text-[var(--text-secondary)]">
        Dieses Profil ist nicht veröffentlicht oder existiert nicht.
      </p>
      <Link href="/behandler" className="mt-6 inline-block font-medium text-[var(--accent)] hover:underline">
        Zum Verzeichnis
      </Link>
    </div>
  )
}
