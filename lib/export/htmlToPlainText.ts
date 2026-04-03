/**
 * Wandelt HTML aus Zusammenfassungen in lesbaren Fließtext um (Kundenexport).
 * Technischer Export kann Roh-HTML beibehalten.
 */

export function htmlToPlainText(html: string | null | undefined): string {
  if (html == null || html === '') return ''
  let s = String(html)
  // Zeilenumbrüche aus Blockelementen
  s = s.replace(/<\s*br\s*\/?>/gi, '\n')
  s = s.replace(/<\/\s*(p|div|h[1-6]|li|tr)\s*>/gi, '\n')
  s = s.replace(/<\s*li\s*>/gi, '• ')
  // Restliche Tags entfernen
  s = s.replace(/<[^>]+>/g, '')
  // HTML-Entities häufiger Fälle
  s = s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
  s = s.replace(/\u00a0/g, ' ')
  // Whitespace normalisieren, Zeilenumbrüche beibehalten
  const lines = s.split('\n').map((line) => line.replace(/[ \t]+/g, ' ').trim())
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
