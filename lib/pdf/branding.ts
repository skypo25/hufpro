import { BRAND_COLORS } from '@/lib/branding'

/**
 * Branding-Optionen für PDF-Ausgabe.
 * Später auf DB/User-Settings umstellbar (Logo-Upload, Farben).
 */

export type PdfBranding = {
  logoUrl?: string | null
  primaryColor: string
  secondaryColor: string
}

export const DEFAULT_PDF_BRANDING: PdfBranding = {
  logoUrl: null,
  primaryColor: BRAND_COLORS.accent,
  secondaryColor: BRAND_COLORS.foreground,
}

/** Liefert aktuell die Defaults; später: aus User-Settings oder DB lesen. */
export function getPdfBranding(): PdfBranding {
  return { ...DEFAULT_PDF_BRANDING }
}
