/** Einfaches RFC4180-ähnliches CSV (Semikolon für DE-Excel oft besser — hier Komma + Quote). */
export function rowsToCsv(rows: Record<string, unknown>[], delimiter = ';'): string {
  if (rows.length === 0) return ''
  const keys = Object.keys(rows[0])
  const esc = (v: unknown): string => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    if (s.includes('"') || s.includes('\n') || s.includes(delimiter)) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  const header = keys.map((k) => esc(k)).join(delimiter)
  const lines = rows.map((row) => keys.map((k) => esc(row[k])).join(delimiter))
  return [header, ...lines].join('\n')
}
