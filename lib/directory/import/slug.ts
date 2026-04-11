import { trimToNull } from './normalize'

const MAX_SLUG_LEN = 120

function slugifyPart(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function baseSlugFromRow(praxisname: string | null, plz: string | null): string {
  const name = trimToNull(praxisname) ?? 'eintrag'
  const zip = trimToNull(plz)?.replace(/\s/g, '') ?? ''
  const a = slugifyPart(name)
  const b = zip ? slugifyPart(zip) : ''
  const combined = b ? `${a}-${b}` : a
  return combined.slice(0, MAX_SLUG_LEN) || 'eintrag'
}
