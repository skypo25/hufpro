import type { Metadata } from 'next'

import { DirectoryProfileCreateWizard } from '@/components/directory/onboarding/DirectoryProfileCreateWizard'
import {
  fetchPublicAnimalTypes,
  fetchPublicMethods,
  fetchPublicSpecialties,
  fetchPublicSubcategories,
} from '@/lib/directory/public/data'

import '@/components/directory/onboarding/profile-create-wizard.css'

/** Taxonomie immer zur Laufzeit laden (kein leeres Bundle vom Build ohne DB). */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Profil erstellen – anidocs',
  description: 'Tierbehandler-Profil in wenigen Schritten anlegen.',
}

export default async function DirectoryProfileCreatePage() {
  const [specialties, subcategories, methods, animals] = await Promise.all([
    fetchPublicSpecialties(),
    fetchPublicSubcategories(),
    fetchPublicMethods(),
    fetchPublicAnimalTypes(),
  ])

  return (
    <DirectoryProfileCreateWizard
      specialties={specialties}
      subcategories={subcategories}
      methods={methods}
      animals={animals}
    />
  )
}
