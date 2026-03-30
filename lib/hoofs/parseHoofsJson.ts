import type { HoofKey, HoofState } from './types'

function mapLegacyHeelBalance(v: string | null | undefined): string | null {
  if (!v) return null
  if (v === 'ausgeglichen') return 'normal'
  if (['med. kürzer', 'lat. kürzer'].includes(v)) return 'ungleich'
  if (v === 'untergeschoben') return 'untergeschoben'
  if (v === 'normal' || v === 'ungleich') return v
  return null
}

function mapLegacyFrogCondition(v: string | null | undefined): string | null {
  if (!v) return null
  if (v === 'faulig') return 'faulig'
  return 'gesund'
}

function mapLegacySoleCondition(v: string | null | undefined): string | null {
  if (!v) return null
  if (v === 'dünn') return 'dünn'
  return 'stabil'
}

function mapLegacyToeAlignment(v: string | null | undefined): string | null {
  if (!v) return null
  if (v === 'bessernd') return 'gerade'
  if (['gerade', 'medial', 'lateral'].includes(v)) return v
  return null
}

export function createInitialHoofs(): Record<HoofKey, HoofState> {
  return {
    vl: {
      hoof_position: 'vl',
      work_status: null,
      angle_deg: null,
      toe_alignment: null,
      heel_balance: null,
      sole_condition: null,
      frog_condition: null,
      notes: null,
    },
    vr: {
      hoof_position: 'vr',
      work_status: null,
      angle_deg: null,
      toe_alignment: null,
      heel_balance: null,
      sole_condition: null,
      frog_condition: null,
      notes: null,
    },
    hl: {
      hoof_position: 'hl',
      work_status: null,
      angle_deg: null,
      toe_alignment: null,
      heel_balance: null,
      sole_condition: null,
      frog_condition: null,
      notes: null,
    },
    hr: {
      hoof_position: 'hr',
      work_status: null,
      angle_deg: null,
      toe_alignment: null,
      heel_balance: null,
      sole_condition: null,
      frog_condition: null,
      notes: null,
    },
  }
}

/**
 * Parst hoofs_json (Array) in ein Record pro Hufposition; mappt Legacy-Werte.
 */
export function parseHoofsFromJson(json: unknown): Record<HoofKey, HoofState> {
  const base = createInitialHoofs()
  if (!json || !Array.isArray(json)) return base
  for (const item of json) {
    if (!item || typeof item !== 'object' || !('hoof_position' in item)) continue
    const pos = (item as { hoof_position?: string }).hoof_position
    if (pos !== 'vl' && pos !== 'vr' && pos !== 'hl' && pos !== 'hr') continue
    const raw = item as HoofState
    base[pos] = {
      ...base[pos],
      hoof_position: pos,
      work_status: raw.work_status ?? null,
      angle_deg: raw.angle_deg ?? null,
      toe_alignment: mapLegacyToeAlignment(raw.toe_alignment) ?? raw.toe_alignment,
      heel_balance: mapLegacyHeelBalance(raw.heel_balance) ?? raw.heel_balance,
      sole_condition: mapLegacySoleCondition(raw.sole_condition) ?? raw.sole_condition,
      frog_condition: mapLegacyFrogCondition(raw.frog_condition) ?? raw.frog_condition,
      notes: raw.notes ?? null,
    }
  }
  return base
}
