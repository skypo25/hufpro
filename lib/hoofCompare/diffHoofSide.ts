import type { HoofState } from '@/lib/hoofs'

export type CompareFieldKey =
  | 'toe_alignment'
  | 'heel_balance'
  | 'sole_condition'
  | 'frog_condition'
  | 'work_status'
  | 'angle_deg'
  | 'notes'

export type FieldDiff = {
  field: CompareFieldKey
  /** Gleicher normalisierter Wert (null = beide leer) */
  equal: boolean
}

function normVal(v: string | number | null | undefined): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return String(v)
  const t = v.trim()
  return t.length ? t : null
}

/** Feldweise Vergleich; gleiche Werte → equal true. */
export function diffHoofSides(
  a: HoofState,
  b: HoofState
): Record<CompareFieldKey, boolean> {
  const keys: CompareFieldKey[] = [
    'toe_alignment',
    'heel_balance',
    'sole_condition',
    'frog_condition',
    'work_status',
    'angle_deg',
    'notes',
  ]
  const out = {} as Record<CompareFieldKey, boolean>
  for (const k of keys) {
    const va = normVal(a[k] as string | number | null | undefined)
    const vb = normVal(b[k] as string | number | null | undefined)
    out[k] = va === vb
  }
  return out
}

export function summarizeDiffGerman(fieldDiff: Record<CompareFieldKey, boolean>): string {
  const changes: string[] = []
  const labels: Record<CompareFieldKey, string> = {
    toe_alignment: 'Zehe',
    heel_balance: 'Trachten',
    sole_condition: 'Sohle',
    frog_condition: 'Strahl',
    work_status: 'Bearbeitung',
    angle_deg: 'Winkel',
    notes: 'Notizen',
  }
  for (const k of Object.keys(labels) as CompareFieldKey[]) {
    if (!fieldDiff[k]) changes.push(labels[k])
  }
  if (changes.length === 0) return 'Keine Befundunterschiede in den angezeigten Feldern.'
  return `${changes.join(', ')} ${changes.length === 1 ? 'weicht ab' : 'weichen ab'}.`
}
