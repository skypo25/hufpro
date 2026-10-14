import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import {
  getEnabledDocumentationModules,
  listUserDocumentationModuleRows,
} from '@/lib/modules/entitlements.server'
import {
  animalTypesForModules,
  listModuleDefinitions,
} from '@/lib/modules/catalog'

/** Nie CDN-/Data-Cache — Modulrechte sind user-spezifisch und ändern sich per Admin. */
export const dynamic = 'force-dynamic'
export const revalidate = 0

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

  // Ohne React.cache — sonst riskant sticky über API-Requests.
  const { enabled, hasEntitlementRows } = await getEnabledDocumentationModules(user.id)
  const rows = await listUserDocumentationModuleRows(user.id)

  return NextResponse.json(
    {
      enabled,
      hasEntitlementRows,
      rows,
      animalTypes: animalTypesForModules(enabled),
      catalog: listModuleDefinitions().map((m) => ({
        id: m.id,
        label: m.label,
        animalTypes: m.animalTypes,
        supportsBodyMap: m.supportsBodyMap,
      })),
    },
    {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
      },
    }
  )
}
