import type { CustomerFormInitialData } from './CustomerForm'

/** Auswahl „Bevorzugter Kontaktweg“ (Desktop + Mobil). */
export const PREFERRED_CONTACT_OPTIONS = ['Telefon / Anruf', 'WhatsApp', 'SMS', 'E-Mail'] as const

export type PreferredContactOption = (typeof PREFERRED_CONTACT_OPTIONS)[number]

/** Entfernte Optionen oder unbekannte Werte → sinnvoller Default fürs Formular. */
export function normalizePreferredContact(raw: string | null | undefined): PreferredContactOption {
  const fallback: PreferredContactOption = 'Telefon / Anruf'
  if (!raw) return fallback
  if (raw === 'Signal / Telegram') return fallback
  if ((PREFERRED_CONTACT_OPTIONS as readonly string[]).includes(raw)) {
    return raw as PreferredContactOption
  }
  return fallback
}

export const emptyCustomerFormData: CustomerFormInitialData = {
  salutation: '',
  firstName: '',
  lastName: '',
  phone: '',
  phone2: '',
  email: '',
  preferredContact: 'Telefon / Anruf',

  billingStreet: '',
  billingCity: '',
  billingZip: '',
  billingCountry: 'Deutschland',
  company: '',
  vatId: '',

  driveTime: '',

  preferredDays: [],
  preferredTime: 'Vormittags (8–12 Uhr)',
  intervalWeeks: '6 Wochen',
  reminderTiming: '3 Tage vorher',

  notes: '',
  source: '',
}