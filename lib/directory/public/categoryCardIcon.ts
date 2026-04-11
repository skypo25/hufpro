/** Bootstrap-Icon-Klasse als Fallback, wenn `/directory/{code}.svg` fehlt oder nicht lädt. */
export function categoryCardBiIconClass(code: string): string {
  if (code === 'tierphysiotherapie') return 'bi-heart-pulse-fill'
  if (code === 'tierosteopathie') return 'bi-hand-index-fill'
  if (code === 'tierheilpraktik') return 'bi-flower2'
  if (code === 'hufschmied') return 'bi-hammer'
  if (code === 'barhufbearbeitung') return 'bi-circle-half'
  /** Allgemeine Hufbearbeitung (nicht Barhuf / nicht Schmied). */
  if (code === 'hufbearbeitung') return 'bi-wrench-adjustable'
  if (code === 'pferdedentist') return 'bi-activity'
  return 'bi-heart-pulse'
}
