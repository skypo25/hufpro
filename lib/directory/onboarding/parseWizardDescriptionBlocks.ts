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

export function parseQualiItemsFromDescription(desc: string | null | undefined): string[] {
  return parseBulletBlock(desc, 'Qualifikationen:')
}

export function parseCustomSpecsFromDescription(desc: string | null | undefined): string[] {
  return parseBulletBlock(desc, 'Eigene Spezialisierungen:')
}

export function parseCustomMethodsFromDescription(desc: string | null | undefined): string[] {
  return parseBulletBlock(desc, 'Eigene Leistungen / Methoden:')
}

/** Blöcke, die auf der Profilseite nur als Chips (nicht im Abschnitt „Über“) erscheinen sollen. */
const DESCRIPTION_BLOCKS_EXCLUDED_FROM_ABOUT = new Set([
  'Qualifikationen:',
  'Eigene Spezialisierungen:',
  'Eigene Leistungen / Methoden:',
])

/**
 * `directory_profiles.description` ohne die Wizard-Blöcke für eigene Spezialisierungen / Leistungen
 * (diese werden separat gerendert). Übrig bleibt Freitext ohne diese Blöcke.
 */
export function descriptionTextForPublicAbout(desc: string | null | undefined): string | null {
  const blocks = descriptionBlocks(desc)
  const kept = blocks.filter((block) => {
    const firstLine = block.split('\n')[0]?.trim() ?? ''
    return !DESCRIPTION_BLOCKS_EXCLUDED_FROM_ABOUT.has(firstLine)
  })
  const out = kept.join('\n\n').trim()
  return out.length > 0 ? out : null
}
