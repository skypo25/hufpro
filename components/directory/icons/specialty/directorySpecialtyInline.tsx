/**
 * Fach-Icons als echte React-SVG (`directorySpecialtyReactIcons.tsx`), damit Turbopack kein `/_next/static/media/`-`<img>` erzeugt.
 * Design-Quelle zum Abgleichen: `icons/specialty-*.svg` → bei Änderungen Script `node scripts/generate-directory-specialty-tsx.mjs` ausführen.
 * Öffentlich: `public/directory/{code}.svg` für `<img>`-Fallback.
 */
import type { FC, SVGProps } from 'react'

import {
  SpecialtyBarhufbearbeitungSvg,
  SpecialtyHufschmiedSvg,
  SpecialtyPferdedentistSvg,
  SpecialtyTierheilpraktikSvg,
  SpecialtyTierosteopathieSvg,
  SpecialtyTierphysiotherapieSvg,
} from './directorySpecialtyReactIcons'

export const directorySpecialtyInlineSvgs: Record<string, FC<SVGProps<SVGSVGElement>>> = {
  barhufbearbeitung: SpecialtyBarhufbearbeitungSvg,
  hufschmied: SpecialtyHufschmiedSvg,
  pferdedentist: SpecialtyPferdedentistSvg,
  tierheilpraktik: SpecialtyTierheilpraktikSvg,
  tierosteopathie: SpecialtyTierosteopathieSvg,
  tierphysiotherapie: SpecialtyTierphysiotherapieSvg,
}
