import fs from 'node:fs'
import path from 'node:path'

const dir = path.resolve('icons')
const files = [
  ['barhufbearbeitung', 'specialty-barhufbearbeitung.svg', 'SpecialtyBarhufbearbeitungSvg'],
  ['hufschmied', 'specialty-hufschmied.svg', 'SpecialtyHufschmiedSvg'],
  ['pferdedentist', 'specialty-pferdedentist.svg', 'SpecialtyPferdedentistSvg'],
  ['tierheilpraktik', 'specialty-tierheilpraktik.svg', 'SpecialtyTierheilpraktikSvg'],
  ['tierosteopathie', 'specialty-tierosteopathie.svg', 'SpecialtyTierosteopathieSvg'],
  ['tierphysiotherapie', 'specialty-tierphysiotherapie.svg', 'SpecialtyTierphysiotherapieSvg'],
]

let out = `import type { FC, SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

`

const pathRe = /<path([\s\S]*?)\/>/g

for (const [, fn, name] of files) {
  const xml = fs.readFileSync(path.join(dir, fn), 'utf8')
  const paths = []
  let m
  while ((m = pathRe.exec(xml))) {
    paths.push(m[1].trim().replace(/\s+/g, ' '))
  }
  out += `export const ${name}: FC<P> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" aria-hidden="true" {...props}>
`
  for (let attrs of paths) {
    attrs = attrs.replace(/\bfill-rule=/g, 'fillRule=').replace(/\bclip-rule=/g, 'clipRule=')
    out += `    <path ${attrs} />\n`
  }
  out += `  </svg>
)

`
}

const outPath = path.resolve(
  'components/directory/icons/specialty/directorySpecialtyReactIcons.tsx',
)
fs.writeFileSync(outPath, out)
console.log('wrote', outPath)
