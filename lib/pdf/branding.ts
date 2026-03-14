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
  primaryColor: "#154226",
  secondaryColor: "#1B1F23",
}

/** Liefert aktuell die Defaults; später: aus User-Settings oder DB lesen. */
export function getPdfBranding(): PdfBranding {
  return { ...DEFAULT_PDF_BRANDING }
}
