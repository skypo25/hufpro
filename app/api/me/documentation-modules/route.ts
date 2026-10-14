import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getEnabledDocumentationModulesCached } from '@/lib/modules/entitlements.server'
import {
  animalTypesForModules,
  listModuleDefinitions,
} from '@/lib/modules/catalog'

/**
 * Effektive Modulrechte + erlaubte Tierarten für den eingeloggten Nutzer.
 * Lesend — Client darf nicht schreiben.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }

  const { enabled, hasEntitlementRows } = await getEnabledDocumentationModulesCached(
    user.id
  )

  return NextResponse.json({
    enabled,
    hasEntitlementRows,
    animalTypes: animalTypesForModules(enabled),
    catalog: listModuleDefinitions().map((m) => ({
      id: m.id,
      label: m.label,
      animalTypes: m.animalTypes,
      supportsBodyMap: m.supportsBodyMap,
    })),
  })
}
