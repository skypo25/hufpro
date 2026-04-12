import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dir = join(__dirname, '../../app/(directory)/behandler/paket-waehlen')
const p1 = readFileSync(join(dir, 'paket-waehlen-raw-part1.css'), 'utf8')
const p2 = readFileSync(join(dir, 'paket-waehlen-raw-part2.css'), 'utf8')
let text = `${p1}\n${p2}`

const rootVars = text.match(/:root\{([^}]+)\}/)?.[1]
if (!rootVars) throw new Error('missing :root')
const bodyInner = text.match(/body\{([^}]+)\}/)?.[1]
if (!bodyInner) throw new Error('missing body')

text = text.replace(/\*,\*::before,\*::after\{[^}]+\}\s*/, '')
text = text.replace(/:root\{[^}]+\}\s*/, '')
text = text.replace(/body\{[^}]+\}\s*/, '')

text = text.replace(/h1,h2,h3\{([^}]+)\}/, (_, inner) => {
  const withVar = inner.replace(
    /font-family:'Outfit',sans-serif/,
    "font-family:var(--font-outfit),'Outfit',system-ui,sans-serif",
  )
  return `#dir-pw-root h1,#dir-pw-root h2,#dir-pw-root h3{${withVar}}`
})
// Raw file often chains `a{...}button{...}` on one line (not matched by ^button)
text = text.replace(/a\{([^}]+)\}button\{([^}]+)\}/, '#dir-pw-root a{$1}\n#dir-pw-root button{$2}')
text = text.replace(/^a\{/m, '#dir-pw-root a{')
text = text.replace(/^button\{/m, '#dir-pw-root button{')

const lines = text.split('\n')
const out = []
for (const line of lines) {
  const stripped = line.trimStart()
  if (stripped.startsWith('.')) {
    const indent = line.length - line.trimStart().length
    const sp = line.slice(0, indent)
    out.push(`${sp}#dir-pw-root ${stripped}`)
  } else {
    out.push(line)
  }
}
text = out.join('\n')

// Minified one-line rules chain with `}.foo` — second selector must stay under #dir-pw-root
text = text.replace(/\}\.([a-zA-Z][a-zA-Z0-9_.-]*)/g, '}#dir-pw-root .$1')
text = text.replace(/font-family:'Outfit'/g, "font-family:var(--font-outfit),'Outfit',system-ui,sans-serif")
text = text.replace(/font-family:'DM Sans',sans-serif/g, "font-family:var(--font-dm-sans),'DM Sans',system-ui,sans-serif")

const varsLine = `${rootVars.trim().replace(/;?\s*$/, '')};`
const bodyRest = bodyInner
  .replace(/font-family:'DM Sans',sans-serif;?/, '')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean)
  .join(';\n  ')

const header = `#dir-pw-root, #dir-pw-root *, #dir-pw-root *::before, #dir-pw-root *::after {
  box-sizing: border-box;
}
#dir-pw-root {
  ${varsLine}
  font-family: var(--font-dm-sans), 'DM Sans', system-ui, sans-serif;
  ${bodyRest};
}
`

writeFileSync(join(dir, 'paket-waehlen.css'), header + text, 'utf8')
console.log('scoped paket-waehlen.css')
