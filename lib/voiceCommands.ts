/**
 * Processes voice command keywords spoken during dictation.
 * Returns an action to apply to the current rich-text content.
 */

export type VoiceCommandResult =
  | { type: 'replace'; html: string }   // replace entire content
  | { type: 'append'; html: string }    // append html to content
  | { type: 'undo' }                    // remove last inserted paragraph
  | { type: 'none'; text: string }      // not a command – pass through as text

const CMD = (pattern: RegExp) =>
  (text: string) => pattern.test(text.trim())

const CLEAR     = CMD(/^(alles\s+löschen|alles\s+loeschen|alles\s+weg|feld\s+leeren|löschen\s+alles)\.?$/i)
const PARAGRAPH = CMD(/^(absatz|neuer\s+absatz|neue\s+zeile|zeilenumbruch|enter|nächste\s+zeile|nächster\s+absatz)\.?$/i)
const UNDO      = CMD(/^(rückgängig|letzte[ns]?\s+löschen|letzten?\s+satz\s+löschen|undo)\.?$/i)

// "Überschrift Hier der Text" → <p><strong>Hier der Text</strong></p>
const HEADING_RE = /^(?:überschrift|ueberschrift|bold|fett)[\s:]+(.+)$/i

export function processVoiceCommand(
  transcribed: string,
  currentHtml: string
): VoiceCommandResult {
  const t = transcribed.trim()

  if (CLEAR(t)) return { type: 'replace', html: '' }
  if (PARAGRAPH(t)) return { type: 'append', html: '<p><br></p>' }
  if (UNDO(t)) return { type: 'undo' }

  const headingMatch = t.match(HEADING_RE)
  if (headingMatch) {
    return { type: 'append', html: `<p><strong>${headingMatch[1]}</strong></p>` }
  }

  return { type: 'none', text: t }
}

export function applyVoiceCommand(
  result: VoiceCommandResult,
  currentHtml: string,
  onResult: (html: string) => void,
  fallback: (text: string) => void
) {
  if (result.type === 'replace') {
    onResult(result.html)
    return
  }
  if (result.type === 'append') {
    onResult(currentHtml ? `${currentHtml}${result.html}` : result.html)
    return
  }
  if (result.type === 'undo') {
    // Remove last <p>...</p> block
    const stripped = currentHtml.replace(/<p>(?:(?!<p>).)*<\/p>\s*$/, '').trimEnd()
    onResult(stripped)
    return
  }
  // type === 'none' – pass through as normal text
  fallback(result.text)
}
