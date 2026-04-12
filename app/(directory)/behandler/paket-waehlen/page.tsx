import type { Metadata } from 'next'

import { BehandlerPaketWaehlenLanding } from '@/components/directory/public/BehandlerPaketWaehlenLanding'

import './paket-waehlen.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Paket wählen – anidocs Verzeichnis',
  description:
    'Gratis, Premium-Verzeichnis oder Behandler-System: das passende Paket für dein Verzeichnisprofil wählen.',
}

export default function BehandlerPaketWaehlenPage() {
  return <BehandlerPaketWaehlenLanding />
}
