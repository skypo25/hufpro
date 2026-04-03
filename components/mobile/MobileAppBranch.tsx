'use client'

import MobileShell from './MobileShell'
import { MobileRouteContent } from './mobileRouteMap'

/**
 * Kapselt Mobile-Shell + Routen-Rendering.
 * Wird von AppLayoutClient nur bei schmalem Viewport geladen — Desktop lädt weder
 * useMobileContent noch die großen Mobile-Page-Chunks.
 * `/admin` nutzt nicht diese Branch (siehe AppLayoutClient → AdminAppChromeMobile).
 */
export default function MobileAppBranch({
  readOnlyBanner = null,
}: {
  readOnlyBanner?: { graceEndsAtIso: string } | null
}) {
  return (
    <MobileShell readOnlyBanner={readOnlyBanner}>
      <MobileRouteContent />
    </MobileShell>
  )
}
