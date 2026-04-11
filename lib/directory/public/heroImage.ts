import fs from 'fs'
import path from 'path'

/** Reihenfolge = Priorität. Eigenes Hero-Bild: `public/directory/behandler-hero.webp` (oder .jpg / .png). */
const CANDIDATES = [
  'behandler-hero.webp',
  'behandler-hero.jpg',
  'behandler-hero.png',
  'anidocs-header-portal.png',
  'anidocs-header-portal.jpg',
  'images/hero-animals.png',
  'images/hero-animals.jpg',
  'images/hero-animals.webp',
] as const

/**
 * Liest die erste vorhandene Datei unter `public/directory/` bzw. `public/images/`.
 * `?v=<mtime>` als Cache-Buster. Sonst `null` → Komponente zeigt Platzhalter.
 */
export function resolveBehandlerHeroSrc(): string | null {
  for (const name of CANDIDATES) {
    try {
      const sub = name.startsWith('images/')
        ? ['public', ...name.split('/')]
        : ['public', 'directory', name]
      const full = path.join(process.cwd(), ...sub)
      if (fs.existsSync(full)) {
        const mtimeMs = fs.statSync(full).mtimeMs
        const v = Math.floor(mtimeMs)
        const urlPath = name.startsWith('images/') ? `/${name}` : `/directory/${name}`
        return `${urlPath}?v=${v}`
      }
    } catch {
      return null
    }
  }
  return null
}
