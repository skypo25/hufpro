import type { CustomerFormInitialData } from './CustomerForm'

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