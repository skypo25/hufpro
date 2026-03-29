/**
 * Datenmodell für die Rechnungs-PDF-Erzeugung (§14 UStG).
 */

export type InvoicePdfSeller = {
  logoUrl: string | null
  companyName: string | null
  name: string
  qualification: string | null
  street: string | null
  zip: string | null
  city: string | null
  country: string
  phone: string | null
  email: string | null
  website: string | null
  taxNumber: string | null
  taxOffice: string | null
  ustId: string | null
  kleinunternehmer: boolean
  kleinunternehmerText: string | null
  bank: string | null
  accountHolder: string | null
  iban: string | null
  bic: string | null
}

export type InvoicePdfBuyer = {
  name: string
  company: string | null
  street: string | null
  zip: string | null
  city: string | null
  country: string | null
}

export type InvoicePdfItem = {
  description: string
  quantity: number
  unitPriceCents: number
  amountCents: number
  taxRatePercent: number
}

export type InvoicePdfData = {
  /** Kundennummer (formatiert), über der Rechnungsnummer angezeigt */
  customerNumberDisplay?: string | null
  invoiceNumber: string
  invoiceDate: string
  /** ISO: erste Buchung als versendet (optional, für Anzeige/PDF) */
  sentAt?: string | null
  /** ISO: Zahlungseingang (optional) */
  paidAt?: string | null
  serviceDateFrom: string | null
  serviceDateTo: string | null
  paymentDueDate: string | null
  introText: string | null
  footerText: string | null
  seller: InvoicePdfSeller
  buyer: InvoicePdfBuyer
  items: InvoicePdfItem[]
  totalCents: number
  currency: string
}
