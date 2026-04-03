/**
 * Dateinamen für ZIP/Export: lesbar, ohne Pfad-Sonderzeichen.
 */

const INVALID = /[<>:"/\\|?*\u0000-\u001f]/g
const MULTI_UNDERSCORE = /_+/g

export function sanitizeExportFilenameBase(name: string, maxLen = 120): string {
  let s = name.trim().replace(INVALID, '_').replace(/\s+/g, '_')
  s = s.replace(MULTI_UNDERSCORE, '_').replace(/^_+|_+$/g, '')
  if (s.length > maxLen) s = s.slice(0, maxLen).replace(/_+$/g, '')
  return s || 'Datei'
}

export function ensureUniqueFilename(base: string, ext: string, used: Set<string>): string {
  const e = ext.startsWith('.') ? ext : `.${ext}`
  let candidate = `${base}${e}`
  let n = 2
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base}_${n}${e}`
    n += 1
  }
  used.add(candidate.toLowerCase())
  return candidate
}
