import type { HoofKey, HoofOverallStatus, HoofState } from './types'

/** Standardwerte für „Unauffällig“: Zehe gerade, Trachten normal, Sohle stabil, Strahl gesund */
export const HOOF_STANDARD = {
  toe_alignment: 'gerade' as const,
  heel_balance: 'normal' as const,
  sole_condition: 'stabil' as const,
  frog_condition: 'gesund' as const,
}

/**
 * Berechnet den Gesamtstatus aus allen vier Hufen.
 * - Problematisch: mindestens ein Huf mit Strahl = faulig (kritisch).
 * - Behandlungsbedürftig: Abweichungen, aber nichts Kritisches.
 * - Unauffällig: alle Hufe auf Standardwerten (oder keine Befunde gesetzt).
 */
export function computeHoofOverallStatus(hoofs: Record<HoofKey, HoofState>): HoofOverallStatus {
  const arr = [hoofs.vl, hoofs.vr, hoofs.hl, hoofs.hr]
  for (const h of arr) {
    if (h.frog_condition === 'faulig') return 'problematisch'
  }
  let hasDeviation = false
  for (const h of arr) {
    if (h.toe_alignment && h.toe_alignment !== HOOF_STANDARD.toe_alignment) hasDeviation = true
    const heelStandard = h.heel_balance === HOOF_STANDARD.heel_balance || h.heel_balance === 'ausgeglichen'
    if (h.heel_balance && !heelStandard) hasDeviation = true
    if (h.sole_condition && h.sole_condition !== HOOF_STANDARD.sole_condition) hasDeviation = true
    if (h.frog_condition && h.frog_condition !== HOOF_STANDARD.frog_condition) hasDeviation = true
  }
  return hasDeviation ? 'behandlungsbeduerftig' : 'unauffaellig'
}

export function singleHoofStatus(hoof: HoofState): HoofOverallStatus {
  if (hoof.frog_condition === 'faulig') return 'problematisch'
  const heelStandard = hoof.heel_balance === HOOF_STANDARD.heel_balance || hoof.heel_balance === 'ausgeglichen'
  const hasDeviation =
    (hoof.toe_alignment && hoof.toe_alignment !== HOOF_STANDARD.toe_alignment) ||
    (hoof.heel_balance && !heelStandard) ||
    (hoof.sole_condition && hoof.sole_condition !== HOOF_STANDARD.sole_condition) ||
    (hoof.frog_condition && hoof.frog_condition !== HOOF_STANDARD.frog_condition)
  return hasDeviation ? 'behandlungsbeduerftig' : 'unauffaellig'
}

export function hoofOverallStatusLabel(status: HoofOverallStatus): string {
  switch (status) {
    case 'problematisch':
      return 'Problematisch'
    case 'behandlungsbeduerftig':
      return 'Behandlungsbedürftig'
    case 'unauffaellig':
      return 'Unauffällig'
    default:
      return '–'
  }
}
