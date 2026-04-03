/**
 * Deutsche Anzeige-Labels für Enum-/Technikwerte im Kundenexport.
 */

import { SLOT_LABELS } from '@/lib/photos/photoTypes'

export function labelDocumentationKind(kind: string | null | undefined): string {
  if (!kind) return ''
  switch (kind) {
    case 'hoof':
      return 'Hufdokumentation'
    case 'therapy':
      return 'Therapiedokumentation'
    default:
      return kind
  }
}

export function labelTherapyDiscipline(v: string | null | undefined): string {
  if (!v) return ''
  switch (v) {
    case 'physio':
      return 'Physiotherapie'
    case 'osteo':
      return 'Osteopathie'
    case 'heilpraktik':
      return 'Heilpraktik'
    case 'other':
      return 'Sonstiges'
    default:
      return v
  }
}

export function labelSessionType(v: string | null | undefined): string {
  if (!v) return ''
  switch (v) {
    case 'first':
      return 'Ersttermin'
    case 'regular':
      return 'Regeltermin'
    case 'control':
      return 'Kontrolle'
    case 'other':
      return 'Sonstiges'
    default:
      return v
  }
}

export function labelAnimalType(v: string | null | undefined): string {
  if (!v) return ''
  switch (v) {
    case 'horse':
      return 'Pferd'
    case 'small_animal':
      return 'Kleintier'
    default:
      return v
  }
}

export function labelInvoiceStatus(v: string | null | undefined): string {
  if (!v) return ''
  switch (v) {
    case 'draft':
      return 'Entwurf'
    case 'sent':
      return 'Versendet'
    case 'paid':
      return 'Bezahlt'
    case 'cancelled':
      return 'Storniert'
    default:
      return v
  }
}

export function labelPhotoType(photoType: string | null | undefined): string {
  if (!photoType) return ''
  if (photoType.startsWith('tx.')) {
    return `Therapie: ${photoType.slice(3).replace(/_/g, ' ')}`
  }
  return SLOT_LABELS[photoType] ?? photoType.replace(/_/g, ' ')
}

export function splitStreetHouse(street: string | null | undefined): { strasse: string; hausnummer: string } {
  if (!street?.trim()) return { strasse: '', hausnummer: '' }
  const t = street.trim()
  const m = t.match(/^(.*?)[\s,]+(\d+[a-zA-Z\-\/]*)$/)
  if (m && m[1].trim().length > 0) {
    return { strasse: m[1].trim(), hausnummer: m[2] }
  }
  return { strasse: t, hausnummer: '' }
}
