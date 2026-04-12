import 'server-only'

import { fetchPublicProfileBySlug } from '@/lib/directory/public/data'
import { coercePgBool } from '@/lib/directory/public/coercePgBool'
import { createSupabaseServiceRoleClient } from '@/lib/supabase-service'

export type DirectoryPublicProfileDiagnostics = {
  anon: {
    inView: boolean
    top_active: boolean
    premium_contact_enabled: boolean
  }
  /** Nur lokal: Abgleich Service-Role vs. Anon, wenn die View für Anon leer wirkt. */
  devBypass?: {
    baseRow: { listing_status: string; country: string } | null
    serviceRoleSeesInPublicView: boolean
  }
}

export async function loadDirectoryPublicProfileDiagnostics(
  slug: string
): Promise<DirectoryPublicProfileDiagnostics> {
  const s = slug.trim()
  const row = await fetchPublicProfileBySlug(s)
  if (row) {
    return {
      anon: {
        inView: true,
        top_active: coercePgBool(row.top_active),
        premium_contact_enabled: coercePgBool(row.premium_contact_enabled),
      },
    }
  }

  let devBypass: DirectoryPublicProfileDiagnostics['devBypass']
  if (process.env.NODE_ENV === 'development' && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    try {
      const admin = createSupabaseServiceRoleClient()
      const { data: base } = await admin
        .from('directory_profiles')
        .select('listing_status, country')
        .eq('slug', s)
        .maybeSingle()
      const { data: viewHit } = await admin
        .from('directory_public_profiles')
        .select('id')
        .eq('slug', s)
        .limit(1)
      devBypass = {
        baseRow: base
          ? {
              listing_status: String((base as { listing_status?: string }).listing_status ?? ''),
              country: String((base as { country?: string }).country ?? ''),
            }
          : null,
        serviceRoleSeesInPublicView: (viewHit?.length ?? 0) > 0,
      }
    } catch {
      devBypass = undefined
    }
  }

  return {
    anon: {
      inView: false,
      top_active: false,
      premium_contact_enabled: false,
    },
    devBypass,
  }
}
