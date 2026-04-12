/**
 * PostgREST liefert Booleans meist als true/false; in Randfällen (Views, Casts) kann ein Wert als String ankommen.
 * `Boolean("false")` wäre in JS true — daher explizite Auswertung.
 */
export function coercePgBool(v: unknown): boolean {
  if (v === true || v === 1) return true
  if (v === false || v === 0) return false
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    return s === 't' || s === 'true' || s === '1' || s === 'yes'
  }
  return false
}
