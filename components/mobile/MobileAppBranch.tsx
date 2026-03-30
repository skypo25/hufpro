'use client'

import MobileShell from './MobileShell'
import { MobileRouteContent } from './mobileRouteMap'

/**
 * Kapselt Mobile-Shell + Routen-Rendering.
 * Wird von AppLayoutClient nur bei schmalem Viewport geladen — Desktop lädt weder
 * useMobileContent noch die großen Mobile-Page-Chunks.
 */
export default function MobileAppBranch() {
  return (
    <MobileShell>
      <MobileRouteContent />
    </MobileShell>
  )
}
