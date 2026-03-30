/**
 * Kanonische Huf-Dokumentation pro Position (vl/vr/hl/hr).
 * Wird in hoof_records.hoofs_json und hoof_payload.hoofs verwendet.
 */

export type HoofKey = 'vl' | 'vr' | 'hl' | 'hr'

export type HoofState = {
  hoof_position: HoofKey
  work_status: string | null
  angle_deg: number | null
  toe_alignment: string | null
  heel_balance: string | null
  sole_condition: string | null
  frog_condition: string | null
  notes: string | null
}

export type HoofOverallStatus = 'unauffaellig' | 'behandlungsbeduerftig' | 'problematisch'
