import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DirectoryClaimForm } from '@/components/directory/claim/DirectoryClaimForm'
import { fetchPublicProfileBySlug } from '@/lib/directory/public/data'
import { createSupabaseServerClient } from '@/lib/supabase-server'

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ submitted?: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const profile = await fetchPublicProfileBySlug(slug)
  if (!profile) return { title: 'Profil nicht gefunden | AniDocs' }
  return {
    title: `Profil beanspruchen · ${profile.display_name} | AniDocs`,
    robots: { index: false, follow: true },
  }
}

export default async function DirectoryClaimPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const { submitted: submittedFlag } = await searchParams
  const profile = await fetchPublicProfileBySlug(slug)
  if (!profile) notFound()

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const loginNext = `/behandler/${encodeURIComponent(slug)}/claim`

  return (
    <div className="dir-prof-page" data-directory-page="claim">
      <div className="dir-prof-content max-w-[640px] py-10">
        <p className="mb-2 text-sm text-[var(--dir-text-secondary)]">
          <Link href={`/behandler/${profile.slug}`} className="text-[var(--dir-accent)] hover:underline">
            ← Zum Profil
          </Link>
        </p>
        <h1 className="mb-2 font-[family-name:var(--font-outfit)] text-2xl font-bold text-[var(--dir-text)]">
          Profil beanspruchen
        </h1>
        <p className="mb-6 text-sm text-[var(--dir-text-secondary)]">
          <strong>{profile.display_name}</strong> — Antrag auf Übernahme des öffentlichen Verzeichniseintrags. Es wird ein
          Eintrag in <code className="text-xs">directory_claims</code> mit Status <code className="text-xs">pending</code>{' '}
          erstellt; die Bearbeitung erfolgt durch AniDocs.
        </p>

        {submittedFlag === '1' ? (
          <div className="dir-prof-card">
            <div className="dir-prof-card-body">
              <p className="text-sm font-medium text-[var(--dir-accent-dark)]">
                Vielen Dank — dein Antrag wurde gespeichert. Wir melden uns nach Prüfung.
              </p>
              <Link href={`/behandler/${profile.slug}`} className="mt-4 inline-block text-sm text-[var(--dir-accent)] hover:underline">
                Zurück zum Profil
              </Link>
            </div>
          </div>
        ) : !user ? (
          <div className="dir-prof-card">
            <div className="dir-prof-card-header">
              <i className="bi bi-person-lock" aria-hidden />
              <h2 className="!text-base">Anmeldung erforderlich</h2>
            </div>
            <div className="dir-prof-card-body space-y-4">
              <p className="text-sm text-[var(--dir-text-secondary)]">
                Nur angemeldete Nutzer:innen können einen Claim absenden. Bitte melde dich an — danach kehrst du zu dieser
                Seite zurück.
              </p>
              <Link
                href={`/login?next=${encodeURIComponent(loginNext)}`}
                className="dir-prof-btn dir-prof-btn--accent inline-flex justify-center"
              >
                Zur Anmeldung
              </Link>
            </div>
          </div>
        ) : (
          <div className="dir-prof-card">
            <div className="dir-prof-card-header">
              <i className="bi bi-inbox-fill" aria-hidden />
              <h2 className="!text-base">Antrag</h2>
            </div>
            <div className="dir-prof-card-body">
              <DirectoryClaimForm slug={profile.slug} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
