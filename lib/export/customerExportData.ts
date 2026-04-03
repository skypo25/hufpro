/**
 * Mapping Rohdaten → Zeilen für den lesbaren Kundenexport (deutsche Spaltennamen).
 */

import { formatCustomerNumber, formatGermanDate, formatGermanDateTime } from '@/lib/format'
import { htmlToPlainText } from '@/lib/export/htmlToPlainText'
import {
  labelAnimalType,
  labelDocumentationKind,
  labelInvoiceStatus,
  labelPhotoType,
  labelSessionType,
  labelTherapyDiscipline,
  splitStreetHouse,
} from '@/lib/export/exportLabels'

export type CustomerRow = Record<string, unknown>
export type HorseRow = Record<string, unknown>
export type DocumentationRow = Record<string, unknown>
export type HoofRecordRow = Record<string, unknown>

function fullCustomerName(c: CustomerRow): string {
  const legacy = (c.name as string | null)?.trim()
  if (legacy) return legacy
  const fn = (c.first_name as string | null)?.trim()
  const ln = (c.last_name as string | null)?.trim()
  const joined = [fn, ln].filter(Boolean).join(' ').trim()
  return joined || ''
}

/** Export für Fotos-CSV / konsistente Kundenzeile */
export function customerDisplayName(c: Record<string, unknown> | undefined): string {
  if (!c) return ''
  return fullCustomerName(c as CustomerRow)
}

function formatBirthDisplay(horse: HorseRow): string {
  const y = horse.birth_year as number | null | undefined
  if (y == null || Number.isNaN(Number(y))) return ''
  return String(y)
}

export function buildKundenCsvRows(args: {
  customers: CustomerRow[]
  customerNumberPrefix: string
}): Record<string, unknown>[] {
  const { customers, customerNumberPrefix } = args
  return customers.map((c) => {
    const { strasse, hausnummer } = splitStreetHouse(c.street as string | null | undefined)
    const num = c.customer_number as number | null | undefined
    return {
      Kundennummer: num != null ? formatCustomerNumber(num, customerNumberPrefix) : '',
      Anrede: (c.salutation as string | null) ?? '',
      Vorname: (c.first_name as string | null) ?? '',
      Nachname: (c.last_name as string | null) ?? '',
      'Vollständiger Name': fullCustomerName(c),
      Firma: (c.company as string | null) ?? '',
      Straße: strasse || (c.street as string | null)?.trim() || '',
      Hausnummer: hausnummer,
      PLZ: (c.postal_code as string | null) ?? '',
      Ort: (c.city as string | null) ?? '',
      Land: (c.country as string | null) ?? '',
      Telefon: (c.phone as string | null) ?? '',
      'E-Mail': (c.email as string | null) ?? '',
      'Bevorzugter Kontaktweg': (c.preferred_contact as string | null) ?? '',
      Notizen: (c.notes as string | null) ?? '',
      'Erfasst am': c.created_at ? formatGermanDateTime(String(c.created_at)) : '',
      interne_kunden_id: c.id as string,
    }
  })
}

export function buildTiereCsvRows(args: {
  horses: HorseRow[]
  customerById: Map<string, CustomerRow>
  customerNumberPrefix: string
}): Record<string, unknown>[] {
  const { horses, customerById, customerNumberPrefix } = args
  return horses.map((h) => {
    const cid = h.customer_id as string | null | undefined
    const cust = cid ? customerById.get(cid) : undefined
    const num = cust?.customer_number as number | null | undefined
    return {
      Tiername: (h.name as string | null) ?? '',
      Tierart: labelAnimalType(h.animal_type as string | null),
      Besitzer: cust ? fullCustomerName(cust) : '',
      Kundennummer: cust && num != null ? formatCustomerNumber(num, customerNumberPrefix) : '',
      Geburtsdatum: formatBirthDisplay(h),
      Geschlecht: (h.sex as string | null) ?? '',
      Rasse: (h.breed as string | null) ?? '',
      Farbe: '',
      Notizen: (h.notes as string | null) ?? '',
      'Erfasst am': h.created_at ? formatGermanDateTime(String(h.created_at)) : '',
      interne_tier_id: h.id as string,
      interne_kunden_id: cid ?? '',
    }
  })
}

export function buildTermineCsvRows(args: {
  appointments: Record<string, unknown>[]
  appointmentHorses: { appointment_id: string; horse_id: string }[]
  customerById: Map<string, CustomerRow>
  horseById: Map<string, HorseRow>
}): Record<string, unknown>[] {
  const { appointments, appointmentHorses, customerById, horseById } = args
  const horsesByApt = new Map<string, string[]>()
  for (const link of appointmentHorses) {
    const name = horseById.get(link.horse_id)?.name as string | null | undefined
    const label = name?.trim() || ''
    const arr = horsesByApt.get(link.appointment_id) ?? []
    if (label) arr.push(label)
    horsesByApt.set(link.appointment_id, arr)
  }

  return appointments.map((a) => {
    const cid = a.customer_id as string | null | undefined
    const cust = cid ? customerById.get(cid) : undefined
    const aptId = a.id as string
    const horseNames = horsesByApt.get(aptId) ?? []
    const ad = a.appointment_date as string | null | undefined
    let terminAm = ''
    let uhrzeit = ''
    if (ad) {
      const d = new Date(ad)
      if (!Number.isNaN(d.getTime())) {
        terminAm = new Intl.DateTimeFormat('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(d)
        uhrzeit = new Intl.DateTimeFormat('de-DE', {
          hour: '2-digit',
          minute: '2-digit',
        }).format(d)
      }
    }
    const dur = a.duration_minutes as number | null | undefined
    return {
      'Termin am': terminAm,
      Uhrzeit: uhrzeit,
      Kunde: cust ? fullCustomerName(cust) : '',
      Tiername: horseNames.join(', '),
      Terminart: (a.type as string | null) ?? '',
      Status: (a.status as string | null) ?? '',
      'Dauer in Minuten': dur != null && !Number.isNaN(Number(dur)) ? String(dur) : '',
      Notiz: (a.notes as string | null) ?? '',
      'Erstellt am': a.created_at ? formatGermanDateTime(String(a.created_at)) : '',
      interne_termin_id: aptId,
      interne_kunden_id: cid ?? '',
    }
  })
}

export function legacyHoofIdFromDocumentationMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null
  const v = (metadata as { legacy_hoof_record_id?: unknown }).legacy_hoof_record_id
  return typeof v === 'string' && v.length > 0 ? v : null
}

export function buildDokumentationenCsvRows(args: {
  documentationRecords: DocumentationRow[]
  hoofOnlyRecords: HoofRecordRow[]
  horseById: Map<string, HorseRow>
  customerById: Map<string, CustomerRow>
}): Record<string, unknown>[] {
  const { documentationRecords, hoofOnlyRecords, horseById, customerById } = args

  const docPart = documentationRecords.map((d) => {
    const horseId = d.animal_id as string
    const h = horseById.get(horseId)
    const cid = h?.customer_id as string | null | undefined
    const cust = cid ? customerById.get(cid) : undefined
    const kind = d.documentation_kind as string | null
    const disc = d.therapy_discipline as string | null
    const fach =
      kind === 'therapy' && disc
        ? labelTherapyDiscipline(disc)
        : kind === 'hoof'
          ? 'Huf'
          : ''
    const row = {
      Dokumentationsdatum: d.session_date ? formatGermanDate(String(d.session_date)) : '',
      Tiername: (h?.name as string | null) ?? '',
      Kunde: cust ? fullCustomerName(cust) : '',
      Tierart: labelAnimalType(h?.animal_type as string | null),
      Dokumentationstyp: labelDocumentationKind(kind),
      Fachbereich: fach,
      Terminart: labelSessionType(d.session_type as string | null),
      Titel: (d.title as string | null) ?? '',
      Zusammenfassung: htmlToPlainText(d.summary_html as string | null),
      Empfehlung: htmlToPlainText(d.recommendations_html as string | null),
      'HTML-Dateiname': '',
      'Anzahl Fotos': '',
      interne_dokumentations_id: d.id as string,
      interne_tier_id: horseId,
    }
    return row
  })

  const hoofPart = hoofOnlyRecords.map((r) => {
    const horseId = r.horse_id as string
    const h = horseById.get(horseId)
    const cid = h?.customer_id as string | null | undefined
    const cust = cid ? customerById.get(cid) : undefined
    const row = {
      Dokumentationsdatum: r.record_date ? formatGermanDate(String(r.record_date)) : '',
      Tiername: (h?.name as string | null) ?? '',
      Kunde: cust ? fullCustomerName(cust) : '',
      Tierart: labelAnimalType(h?.animal_type as string | null),
      Dokumentationstyp: 'Hufdokumentation (älteres Format)',
      Fachbereich: '',
      Terminart: '',
      Titel: '',
      Zusammenfassung: htmlToPlainText(r.hoof_condition as string | null),
      Empfehlung: htmlToPlainText(r.notes as string | null),
      'HTML-Dateiname': '',
      'Anzahl Fotos': '',
      interne_dokumentations_id: '',
      interne_tier_id: horseId,
    }
    return row
  })

  return [...docPart, ...hoofPart]
}

function formatEuroFromCents(cents: number): string {
  const n = cents / 100
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function lineTaxNetGross(amountCents: number, taxRatePercent: number): { tax: number; gross: number } {
  const net = amountCents / 100
  const rate = taxRatePercent / 100
  const tax = net * rate
  const gross = net + tax
  return { tax: Math.round(tax * 100) / 100, gross: Math.round(gross * 100) / 100 }
}

export function buildRechnungenCsvRows(args: {
  invoices: Record<string, unknown>[]
  itemsByInvoiceId: Map<string, { amount_cents: number; tax_rate_percent: number }[]>
  customerById: Map<string, CustomerRow>
}): Record<string, unknown>[] {
  const { invoices, itemsByInvoiceId, customerById } = args
  return invoices.map((inv) => {
    const id = inv.id as string
    const items = itemsByInvoiceId.get(id) ?? []
    let netCents = 0
    let taxTotal = 0
    let grossTotal = 0
    for (const it of items) {
      netCents += it.amount_cents
      const { tax, gross } = lineTaxNetGross(it.amount_cents, Number(it.tax_rate_percent) || 0)
      taxTotal += tax
      grossTotal += gross
    }
    const cid = inv.customer_id as string | null | undefined
    const cust = cid ? customerById.get(cid) : undefined
    const buyer =
      (inv.buyer_name as string | null)?.trim() ||
      (cust ? fullCustomerName(cust) : '') ||
      ''
    return {
      Rechnungsnummer: (inv.invoice_number as string | null) ?? '',
      Rechnungsdatum: inv.invoice_date ? formatGermanDate(String(inv.invoice_date)) : '',
      Kunde: buyer,
      'Gesamtbetrag netto': formatEuroFromCents(netCents),
      'Gesamtbetrag brutto': new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(grossTotal),
      Steuerbetrag: new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(taxTotal),
      Status: labelInvoiceStatus(inv.status as string | null),
      'Fällig am': inv.payment_due_date ? formatGermanDate(String(inv.payment_due_date)) : '',
      'PDF-Dateiname': '',
      interne_rechnungs_id: id,
    }
  })
}

export function buildRechnungspositionenCsvRows(args: {
  invoices: Record<string, unknown>[]
  items: Record<string, unknown>[]
}): Record<string, unknown>[] {
  const invNumById = new Map<string, string>()
  for (const inv of args.invoices) {
    invNumById.set(inv.id as string, (inv.invoice_number as string) ?? '')
  }
  const rows: Record<string, unknown>[] = []
  for (const it of args.items) {
    const iid = it.invoice_id as string
    const amountCents = Number(it.amount_cents) || 0
    const unitCents = Number(it.unit_price_cents) || 0
    const qty = Number(it.quantity) || 1
    const taxP = Number(it.tax_rate_percent) || 0
    const { tax, gross } = lineTaxNetGross(amountCents, taxP)
    rows.push({
      Rechnungsnummer: invNumById.get(iid) ?? '',
      Positionsnummer: String(it.position ?? ''),
      Bezeichnung: (it.description as string | null) ?? '',
      Menge: String(qty).replace('.', ','),
      'Einzelpreis netto': formatEuroFromCents(unitCents),
      'Gesamtpreis netto': formatEuroFromCents(amountCents),
      Steuersatz: String(taxP).replace('.', ','),
      'Gesamtpreis brutto': new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(gross),
    })
  }
  return rows
}

export function photoLabelForExport(photoType: string | null): string {
  return labelPhotoType(photoType)
}
