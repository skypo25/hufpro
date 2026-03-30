/**
 * Erzeugt ein PNG mit zwei Huf-Fotos nebeneinander (ohne zusätzliche Bibliothek).
 * Lädt Bilder per fetch → Blob → Object URL, damit der Canvas nicht „tainted“ wird.
 */

function sanitizeFilenamePart(s: string): string {
  return s
    .trim()
    .replace(/[^\wäöüÄÖÜß\-]+/g, '_')
    .slice(0, 80) || 'export'
}

async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  const res = await fetch(url, { mode: 'cors', credentials: 'omit' })
  if (!res.ok) throw new Error(`Bild: HTTP ${res.status}`)
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Bild konnte nicht gezeichnet werden'))
      img.src = objectUrl
    })
    return img
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/** Entspricht `rounded-xl` (12px) im Vollbild-Modal */
const IMAGE_CORNER_RADIUS = 12

/** Vollschwarz wie im Share-Mockup */
const BG = '#000000'

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, radius)
}

/** Wie CSS object-cover: Bild füllt das Rechteck, Beschnitt mittig */
function drawImageCoverRounded(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  if (!iw || !ih) return
  const scale = Math.max(w / iw, h / ih)
  const dw = iw * scale
  const dh = ih * scale
  const dx = x + (w - dw) / 2
  const dy = y + (h - dh) / 2

  ctx.save()
  roundRectPath(ctx, x, y, w, h, radius)
  ctx.clip()
  ctx.drawImage(img, dx, dy, dw, dh)
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 1
  roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius)
  ctx.stroke()
  ctx.restore()
}

function drawPlaceholderRounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  label: string
) {
  ctx.save()
  ctx.fillStyle = '#1a1a1a'
  roundRectPath(ctx, x, y, w, h, radius)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.lineWidth = 1
  roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius)
  ctx.stroke()
  ctx.fillStyle = '#6b7280'
  ctx.font = '14px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x + w / 2, y + h / 2)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.restore()
}

/** Titel links, „Erstellt mit:“ + Logo rechts (Mockup) */
function drawHeaderRow(
  ctx: CanvasRenderingContext2D,
  w: number,
  padding: number,
  titleLine: string,
  logo: HTMLImageElement | null
) {
  const headerBaseline = 34
  const label = 'Erstellt mit:'
  const logoH = 26
  const gapLabelLogo = 10

  ctx.font = '500 13px system-ui, "DM Sans", sans-serif'
  const labelW = ctx.measureText(label).width
  let logoW = 0
  let rightBlockW = 0

  if (logo && logo.naturalWidth > 0) {
    logoW = Math.round(logoH * (logo.naturalWidth / Math.max(logo.naturalHeight, 1)))
    rightBlockW = labelW + gapLabelLogo + logoW
  } else {
    const fallback = 'www.anidocs.de'
    rightBlockW = labelW + gapLabelLogo + ctx.measureText(fallback).width
  }

  ctx.fillStyle = '#f1f2f0'
  ctx.font = '600 20px system-ui, "DM Sans", sans-serif'
  const maxTitleW = Math.max(80, w - padding * 2 - rightBlockW - 20)
  let title = titleLine
  if (ctx.measureText(title).width > maxTitleW) {
    while (title.length > 1 && ctx.measureText(`${title.slice(0, -1)}…`).width > maxTitleW) {
      title = title.slice(0, -1)
    }
    title = `${title}…`
  }
  ctx.fillText(title, padding, headerBaseline)

  const right = w - padding
  ctx.font = '500 13px system-ui, "DM Sans", sans-serif'
  ctx.fillStyle = '#f1f2f0'

  if (logo && logoW > 0) {
    const logoLeft = right - logoW
    const labelLeft = logoLeft - gapLabelLogo - labelW
    ctx.fillText(label, labelLeft, headerBaseline)
    const logoTop = (52 - logoH) / 2
    ctx.drawImage(logo, logoLeft, logoTop, logoW, logoH)
  } else {
    const fallback = 'www.anidocs.de'
    const fw = ctx.measureText(fallback).width
    ctx.fillText(fallback, right - fw, headerBaseline)
    const labelLeft = right - fw - gapLabelLogo - labelW
    ctx.fillText(label, labelLeft, headerBaseline)
  }
}

export type ExportComparePngParams = {
  leftUrl: string | null
  rightUrl: string | null
  /** z. B. „Fotovergleich · VL Sohlenansicht“ */
  titleLine: string
  leftCaption: string
  rightCaption: string
  /** Dateiname ohne Endung */
  filenameBase: string
}

/**
 * Triggert den Download einer PNG-Datei.
 */
export async function exportCompareSideBySidePng(params: ExportComparePngParams): Promise<void> {
  const { leftUrl, rightUrl, titleLine, leftCaption, rightCaption, filenameBase } = params

  const padding = 28
  const headerH = 52
  const captionGapBelowPhoto = 22
  const gap = 20
  /** Breite eines Foto-Streifens (9:16) */
  const colW = 420
  const imgH = (colW * 16) / 9

  const innerW = colW * 2 + gap
  const w = innerW + padding * 2
  const y0 = headerH
  const capY = y0 + imgH + captionGapBelowPhoto
  const h = Math.ceil(capY + 18 + padding)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas nicht verfügbar')

  ctx.fillStyle = BG
  ctx.fillRect(0, 0, w, h)

  /* Kein SVG-Logo: foreignObject in SVGs tünt Canvas in Safari → nur Text-Branding */
  drawHeaderRow(ctx, w, padding, titleLine, null)

  const drawPlaceholder = (x: number, label: string) => {
    drawPlaceholderRounded(ctx, x, y0, colW, imgH, IMAGE_CORNER_RADIUS, label)
  }

  let imgL: HTMLImageElement | null = null
  let imgR: HTMLImageElement | null = null

  if (leftUrl) {
    try {
      imgL = await loadImageFromUrl(leftUrl)
    } catch {
      drawPlaceholder(padding, 'Vorher — nicht ladbar')
    }
  } else {
    drawPlaceholder(padding, 'Kein Foto (links)')
  }

  if (rightUrl) {
    try {
      imgR = await loadImageFromUrl(rightUrl)
    } catch {
      drawPlaceholder(padding + colW + gap, 'Nachher — nicht ladbar')
    }
  } else {
    drawPlaceholder(padding + colW + gap, 'Kein Foto (rechts)')
  }

  if (imgL) {
    drawImageCoverRounded(ctx, imgL, padding, y0, colW, imgH, IMAGE_CORNER_RADIUS)
  }
  if (imgR) {
    drawImageCoverRounded(ctx, imgR, padding + colW + gap, y0, colW, imgH, IMAGE_CORNER_RADIUS)
  }

  ctx.fillStyle = '#60a5fa'
  ctx.font = '600 13px system-ui, sans-serif'
  ctx.fillText(leftCaption, padding, capY)
  ctx.fillStyle = '#4ade80'
  ctx.fillText(rightCaption, padding + colW + gap, capY)

  const safeName = sanitizeFilenamePart(filenameBase)

  try {
    await new Promise<void>((resolve, reject) => {
      try {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('PNG konnte nicht erzeugt werden'))
              return
            }
            const a = document.createElement('a')
            const url = URL.createObjectURL(blob)
            a.href = url
            a.download = `${safeName}.png`
            a.click()
            URL.revokeObjectURL(url)
            resolve()
          },
          'image/png',
          0.92
        )
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  } catch (e) {
    const name = e instanceof Error ? e.name : ''
    if (name === 'SecurityError' || (e instanceof Error && /insecure/i.test(e.message))) {
      throw new Error(
        'Export auf diesem Gerät blockiert. Bitte erneut versuchen oder die Seite in Safari öffnen.'
      )
    }
    throw e
  }
}

export function defaultCompareExportFilename(horseName: string): string {
  const d = new Date()
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return `Fotovergleich_${sanitizeFilenamePart(horseName)}_${stamp}`
}
