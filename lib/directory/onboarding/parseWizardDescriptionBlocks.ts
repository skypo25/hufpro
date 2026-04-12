/**
 * Parst die im Wizard in `directory_profiles.description` gespeicherten Textblöcke
 * (gleiches Format wie `buildExtendedDescription` in submitWizardProfile).
 */

function normalizeDescription(desc: string | null | undefined): string {
  return (desc ?? '').replace(/\r\n/g, '\n')
}

function descriptionBlocks(desc: string | null | undefined): string[] {
  const t = normalizeDescription(desc).trim()
  if (!t) return []
  return t
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean)
}

function parseBulletBlock(desc: string | null | undefined, headerLine: string): string[] {
  for (const block of descriptionBlocks(desc)) {
    const lines = block.split('\n').map((l) => l.trim())
    if (lines[0] !== headerLine) continue
    return lines
      .slice(1)
      .map((l) => l.replace(/^-\s*/, '').trim())
      .filter(Boolean)
  }
  return []
}

const CUSTOM_SPEC_HEADER_LEGACY = 'Eigene Spezialisierungen:'
const CUSTOM_METHOD_HEADER_LEGACY = 'Eigene Leistungen / Methoden:'
const CUSTOM_SPEC_HEADER_PREFIX = /^Eigene Spezialisierungen\s*\((.+)\):\s*$/
const CUSTOM_METHOD_HEADER_PREFIX = /^Eigene Leistungen \/ Methoden\s*\((.+)\):\s*$/

function parseBulletBlocksMatching(desc: string | null | undefined, legacyHeader: string, prefixRe: RegExp): string[] {
  const out: string[] = []
  for (const block of descriptionBlocks(desc)) {
    const lines = block.split('\n').map((l) => l.trim())
    const h = lines[0] ?? ''
    if (h === legacyHeader || prefixRe.test(h)) {
      out.push(
        ...lines
          .slice(1)
          .map((l) => l.replace(/^-\s*/, '').trim())
          .filter(Boolean)
      )
    }
  }
  return [...new Set(out)]
}

export function parseQualiItemsFromDescription(desc: string | null | undefined): string[] {
  return parseBulletBlock(desc, 'Qualifikationen:')
}

export function parseCustomSpecsFromDescription(desc: string | null | undefined): string[] {
  return parseBulletBlocksMatching(desc, CUSTOM_SPEC_HEADER_LEGACY, CUSTOM_SPEC_HEADER_PREFIX)
}

export function parseCustomMethodsFromDescription(desc: string | null | undefined): string[] {
  return parseBulletBlocksMatching(desc, CUSTOM_METHOD_HEADER_LEGACY, CUSTOM_METHOD_HEADER_PREFIX)
}

/** Blöcke, die auf der Profilseite nur als Chips (nicht im Abschnitt „Über“) erscheinen sollen. */
function isWizardChipBlockFirstLine(line: string): boolean {
  const t = line.trim()
  if (t === 'Qualifikationen:') return true
  if (t === CUSTOM_SPEC_HEADER_LEGACY) return true
  if (t === CUSTOM_METHOD_HEADER_LEGACY) return true
  if (CUSTOM_SPEC_HEADER_PREFIX.test(t)) return true
  if (CUSTOM_METHOD_HEADER_PREFIX.test(t)) return true
  return false
}

/**
 * `directory_profiles.description` ohne die Wizard-Blöcke für eigene Spezialisierungen / Leistungen
 * (diese werden separat gerendert). Übrig bleibt Freitext ohne diese Blöcke.
 */
export function descriptionTextForPublicAbout(desc: string | null | undefined): string | null {
  const blocks = descriptionBlocks(desc)
  const kept = blocks.filter((block) => {
    const firstLine = block.split('\n')[0]?.trim() ?? ''
    return !isWizardChipBlockFirstLine(firstLine)
  })
  const out = kept.join('\n\n').trim()
  return out.length > 0 ? out : null
}
