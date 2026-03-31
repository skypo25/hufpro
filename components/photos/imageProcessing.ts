/**
 * Clientseitige Bildverarbeitung vor dem Upload:
 * - Zuschneiden auf Zielseitenverhältnis (9:16 Huf, 4:3 Ganzkörper quer)
 * - Skalieren (max. Kantenlänge)
 * - Komprimieren (JPEG)
 */

const DEFAULT_MIME = 'image/jpeg'

export type ProcessOptions = {
  /** Zielseitenverhältnis width/height, z.B. 9/16 oder 16/9 */
  aspectRatio: number
  /** Maximale längere Kantenlänge in px */
  maxDimension: number
  /** JPEG-Qualität 0–1 */
  quality?: number
}

/**
 * Berechnet Crop-Region (Quelle) und Ausgabemaße (skaliert) für Zielseitenverhältnis.
 */
function getCropAndOutputSize(
  img: HTMLImageElement,
  aspectRatio: number,
  maxDimension: number
): { sx: number; sy: number; sWidth: number; sHeight: number; outWidth: number; outHeight: number } {
  const sw = img.naturalWidth
  const sh = img.naturalHeight
  const imgAspect = sw / sh

  let sWidth = sw
  let sHeight = sh
  let sx = 0
  let sy = 0

  if (imgAspect > aspectRatio) {
    sWidth = sh * aspectRatio
    sx = (sw - sWidth) / 2
  } else {
    sHeight = sw / aspectRatio
    sy = (sh - sHeight) / 2
  }

  let outWidth = sWidth
  let outHeight = sHeight
  if (outWidth > maxDimension || outHeight > maxDimension) {
    if (outWidth >= outHeight) {
      outHeight = (outHeight * maxDimension) / outWidth
      outWidth = maxDimension
    } else {
      outWidth = (outWidth * maxDimension) / outHeight
      outHeight = maxDimension
    }
  }
  return {
    sx,
    sy,
    sWidth,
    sHeight,
    outWidth: Math.round(outWidth),
    outHeight: Math.round(outHeight),
  }
}

function loadImage(src: string | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = typeof src === 'string' ? src : URL.createObjectURL(src)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (typeof src !== 'string') URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      if (typeof src !== 'string') URL.revokeObjectURL(url)
      reject(new Error('Bild konnte nicht geladen werden'))
    }
    img.src = url
  })
}

/**
 * Verarbeitet eine Datei: Crop auf aspectRatio, Skalierung, JPEG-Kompression.
 * Gibt Blob und ermittelte Maße zurück.
 */
export async function processImage(
  file: File,
  options: ProcessOptions
): Promise<{ blob: Blob; width: number; height: number }> {
  const quality = Math.min(1, Math.max(0, options.quality ?? 0.72))
  const objectUrl = URL.createObjectURL(file)
  let img: HTMLImageElement
  try {
    img = await loadImage(objectUrl)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }

  const crop = getCropAndOutputSize(
    img,
    options.aspectRatio,
    options.maxDimension
  )
  const { outWidth: width, outHeight: height, sx, sy, sWidth, sHeight } = crop

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D nicht verfügbar')
  ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Konvertierung zu Blob fehlgeschlagen'))
          return
        }
        resolve({ blob, width, height })
      },
      DEFAULT_MIME,
      quality
    )
  })
}

/**
 * Hufbild (Solar/Lateral etc.): Hochkant 9:16
 */
export async function processHoofImage(
  file: File
): Promise<{ blob: Blob; width: number; height: number }> {
  return processImage(file, {
    aspectRatio: 9 / 16,
    maxDimension: 850,
    quality: 0.72,
  })
}

/** Ganzkörper (quer): max. Breite 850 px, 4:3 */
const WHOLE_BODY_WIDTH = 850
const WHOLE_BODY_HEIGHT = Math.round((WHOLE_BODY_WIDTH * 3) / 4)

/**
 * Ganzkörper: max. 850 px breit (4:3)
 */
export async function processWholeBodyImage(
  file: File
): Promise<{ blob: Blob; width: number; height: number }> {
  return processImage(file, {
    aspectRatio: WHOLE_BODY_WIDTH / WHOLE_BODY_HEIGHT,
    maxDimension: WHOLE_BODY_WIDTH,
    quality: 0.75,
  })
}
