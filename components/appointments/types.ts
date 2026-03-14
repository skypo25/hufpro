export type AppointmentFormMode = 'create' | 'edit'

export type AppointmentCustomer = {
  id: string
  name: string | null
  city: string | null
  phone?: string | null
  /** Rechnungs-/Kundenadresse */
  street?: string | null
  postal_code?: string | null
  country?: string | null
  stable_differs?: boolean | null
  stable_name?: string | null
  stable_city?: string | null
  stable_street?: string | null
  stable_zip?: string | null
  stable_country?: string | null
  directions?: string | null
}

export type AppointmentHorse = {
  id: string
  name: string | null
  breed?: string | null
  sex?: string | null
  birth_year?: number | null
  hoof_status?: string | null
  customer_id: string | null
  last_appointment_date?: string | null
}

export type AppointmentDayItem = {
  id: string
  time: string
  customerName: string
  horseNames: string[]
  typeLabel?: string | null
}

export type AppointmentFormInitialData = {
  appointmentId?: string
  customerId: string
  selectedHorseIds: string[]
  appointmentType: 'Regeltermin' | 'Ersttermin' | 'Kontrolle' | 'Sondertermin'
  appointmentDate: string
  appointmentTime: string
  duration: string
  notes: string
  status: 'Bestätigt' | 'Vorgeschlagen' | 'Warteliste'
}

export type AppointmentFormProps = {
  mode: AppointmentFormMode
  customers: AppointmentCustomer[]
  horses: AppointmentHorse[]
  initialData: AppointmentFormInitialData
  dayItems?: AppointmentDayItem[]
}