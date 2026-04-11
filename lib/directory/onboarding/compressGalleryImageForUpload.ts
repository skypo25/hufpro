/** Ziel-Formate: 16:9 (800×450) bzw. 9:16 (450×800), Ausgabe JPEG. */
export const GALLERY_TARGET_LANDSCAPE = { w: 800, h: 450 } as const
export const GALLERY_TARGET_PORTRAIT = { w: 450, h: 800 } as const

const GALLERY_JPEG_QUALITY = 0.82

/**
 * Skaliert Galerie-Fotos im Browser auf 800×450 (Querformat) bzw. 450×800 (Hochformat),
 * jeweils mit zentriertem Cover-Schnitt auf das Ziel-Seitenverhältnis. Sehr kleine
 * Quellen werden nicht hochskaliert, sondern zentriert auf die Zielfläche gesetzt (Letterbox).
 * Läuft nur im Client (Canvas / createImageBitmap).
 */
export async function compressGalleryImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  try {
    const bitmap = await createImageBitmap(file)
    try {
      const sw = bitmap.width
      const sh = bitmap.height
      if (sw <= 0 || sh <= 0) return file

      const landscape = sw >= sh
      const tw = landscape ? GALLERY_TARGET_LANDSCAPE.w : GALLERY_TARGET_PORTRAIT.w
      const th = landscape ? GALLERY_TARGET_LANDSCAPE.h : GALLERY_TARGET_PORTRAIT.h

      const scaleCover = Math.max(tw / sw, th / sh)
      const scaleCapped = Math.min(1, scaleCover)

      const canvas = document.createElement('canvas')
      canvas.width = tw
      canvas.height = th
      const ctx = canvas.getContext('2d')
      if (!ctx) return file

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, tw, th)

      if (scaleCapped < scaleCover) {
        // Quelle zu klein für Cover ohne Upsampling → komplett sichtbar (contain), zentriert
        const s = Math.min(1, Math.min(tw / sw, th / sh))
        const dw = Math.round(sw * s)
        const dh = Math.round(sh * s)
        const ox = Math.round((tw - dw) / 2)
        const oy = Math.round((th - dh) / 2)
        ctx.drawImage(bitmap, 0, 0, sw, sh, ox, oy, dw, dh)
      } else {
        const s = scaleCover
        const dw = Math.round(sw * s)
        const dh = Math.round(sh * s)
        const ox = Math.round((tw - dw) / 2)
        const oy = Math.round((th - dh) / 2)
        ctx.drawImage(bitmap, 0, 0, sw, sh, ox, oy, dw, dh)
      }

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', GALLERY_JPEG_QUALITY)
      })
      if (!blob || blob.size === 0) return file
      const stem = file.name.replace(/\.[^/.]+$/, '').replace(/\s+/g, '-') || 'foto'
      return new File([blob], `${stem}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
    } finally {
      bitmap.close()
    }
  } catch {
    return file
  }
}
