import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DirectoryProfilePublicDetail } from '@/components/directory/public/profile/DirectoryProfilePublicDetail'
import {
  fetchPublicAnimalTypesByIds,
  fetchPublicMethodsByIds,
  fetchPublicProfileAnimalLinks,
  fetchPublicProfileBySlug,
  fetchPublicProfileMedia,
  fetchPublicProfileMethodLinks,
  fetchPublicProfileSocial,
  fetchPublicProfileSpecialtyLinks,
  fetchPublicProfileSubcategoryLinks,
  fetchPublicSpecialtiesByIds,
  fetchPublicSubcategoriesByIds,
  fetchSimilarPublicProfiles,
} from '@/lib/directory/public/data'

type PageProps = {
  params: Promise<{ slug: string }>
}

function truncateMeta(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trim()}…`
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const profile = await fetchPublicProfileBySlug(slug)
  if (!profile) {
    return { title: 'Eintrag nicht gefunden | AniDocs' }
  }
  const namePart = profile.practice_name
    ? `${profile.display_name} · ${profile.practice_name}`
    : profile.display_name
  const title = `${namePart} | Tierbehandler-Verzeichnis`
  const loc = [profile.city, profile.state].filter(Boolean).join(', ')
  const rawDesc =
    profile.short_description?.trim() ||
    (loc ? `${namePart} — ${loc}. Öffentliches Profil im AniDocs Tierbehandler-Verzeichnis.` : `${namePart} im AniDocs Tierbehandler-Verzeichnis.`)
  const description = truncateMeta(rawDesc, 160)

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    alternates: {
      canonical: `/behandler/${profile.slug}`,
    },
    robots: { index: true, follow: true },
  }
}

export default async function BehandlerProfilePage({ params }: PageProps) {
  const { slug } = await params
  const profile = await fetchPublicProfileBySlug(slug)
  if (!profile) notFound()

  const [specLinks, animalLinks, subLinks, methLinks, media, social] = await Promise.all([
    fetchPublicProfileSpecialtyLinks(profile.id),
    fetchPublicProfileAnimalLinks(profile.id),
    fetchPublicProfileSubcategoryLinks(profile.id),
    fetchPublicProfileMethodLinks(profile.id),
    fetchPublicProfileMedia(profile.id),
    fetchPublicProfileSocial(profile.id),
  ])

  const specialtyIds = specLinks.map((l) => l.directory_specialty_id)
  const animalIds = animalLinks.map((l) => l.directory_animal_type_id)
  const subcategoryIds = subLinks.map((l) => l.directory_subcategory_id)
  const methodIds = methLinks.map((l) => l.directory_method_id)

  const [specialties, animalTypes, subcategories, methods] = await Promise.all([
    fetchPublicSpecialtiesByIds(specialtyIds),
    fetchPublicAnimalTypesByIds(animalIds),
    fetchPublicSubcategoriesByIds(subcategoryIds),
    fetchPublicMethodsByIds(methodIds),
  ])

  const primaryFirst = (a: { id: string }, b: { id: string }) => {
    const pa = specLinks.find((l) => l.directory_specialty_id === a.id)?.is_primary ? 0 : 1
    const pb = specLinks.find((l) => l.directory_specialty_id === b.id)?.is_primary ? 0 : 1
    return pa - pb
  }
  specialties.sort(primaryFirst)

  const similarProfiles = await fetchSimilarPublicProfiles({
    excludeProfileId: profile.id,
    primarySpecialtyId: specialties[0]?.id ?? null,
    state: profile.state,
    limit: 8,
  })

  return (
    <div data-directory-page="profile">
      <DirectoryProfilePublicDetail
        profile={profile}
        specialties={specialties}
        animalTypes={animalTypes}
        subcategories={subcategories}
        methods={methods}
        media={media}
        social={social}
        similarProfiles={similarProfiles}
      />
    </div>
  )
}
