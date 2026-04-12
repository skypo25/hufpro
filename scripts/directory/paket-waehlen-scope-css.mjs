#!/usr/bin/env node
/**
 * Liest rohes CSS (eine Regel pro Zeile mit { am Ende der Selektorzeile) — hier: aus stdin
 * und schreibt scoped CSS für #dir-pw-root.
 *
 * Für dieses Projekt: wir nutzen stattdessen fest eingebettete String-Ersetzung in der Build-Ausgabe.
 * Script-Platzhalter — die finale Datei wird direkt als paket-waehlen.css committed.
 */
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '../..')
const input = join(root, 'app/(directory)/behandler/paket-waehlen/paket-waehlen-raw.css')
const output = join(root, 'app/(directory)/behandler/paket-waehlen/paket-waehlen.css')

let css = readFileSync(input, 'utf8')

css = css.replace(/\r\n/g, '\n')

/** Selektoren am Zeilenanfang vor { — grob, ausreichend für unser Raw-CSS. */
const lines = css.split('\n')
const out = []
let buf = []
for (const line of lines) {
  const t = line.trim()
  if (t.includes('{') && !t.startsWith('@')) {
    const [selPart, rest] = t.split('{', 2)
    const selectors = selPart.split(',').map((s) => s.trim())
    const scoped = selectors.map((s) => (s.startsWith('#dir-pw-root') ? s : `#dir-pw-root ${s}`)).join(', ')
    out.push(`${scoped}{${rest || ''}`)
    continue
  }
  if (t.startsWith('@media')) {
    out.push(line)
    continue
  }
  out.push(line)
}

writeFileSync(output, out.join('\n'), 'utf8')
console.log('written', output)
