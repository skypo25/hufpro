import type { Profession } from '@/lib/appProfile'
import type { TherapyType } from '@/lib/aiFormatter'

/**
 * KI/Sprache: Beruf → therapyType für /api/ai/format-documentation.
 * Hufbearbeiter bleiben im Huf-Formular; Fallback 'huf' soll hier nicht für Therapie-UI genutzt werden.
 */
export function professionToTherapyAiType(profession: Profession): TherapyType {
  switch (profession) {
    case 'tierphysiotherapeut':
      return 'physio'
    case 'osteopath':
      return 'osteo'
    case 'tierheilpraktiker':
    case 'sonstiges':
      return 'heilpraktiker'
    case 'hufbearbeiter':
    default:
      return 'huf'
  }
}
