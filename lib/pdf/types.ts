/**
 * Datenmodell für die PDF-Erzeugung einer Hufdokumentation.
 */

export type RecordPdfHorse = {
  name: string
  breed: string | null
  sex: string | null
  birthYear: number | null
  ageYears?: number | null
}

export type RecordPdfCustomer = {
  customerNumber: number | null
  name: string
  stableName: string | null
  city: string | null
}

export type RecordPdfSeller = {
  logoUrl: string | null
  companyName: string | null
  name: string
  qualification: string | null
  street: string | null
  zip: string | null
  city: string | null
  phone: string | null
  email: string | null
}

export type RecordPdfHoof = {
  position: 'vl' | 'vr' | 'hl' | 'hr'
  toeAlignment: string | null
  heelBalance: string | null
  soleCondition: string | null
  frogCondition: string | null
}

export type RecordPdfRecord = {
  recordDate: string | null
  recordType: string | null
  docNumber: string | null
  lastRecordDate: string | null
  generalCondition: string | null
  gait: string | null
  handlingBehavior: string | null
  hornQuality: string | null
  hoofs: RecordPdfHoof[]
  summaryNotes: string | null
}

export type RecordPdfPhoto = {
  photoType: string
  label: string
  dataUrl: string
}

export type RecordPdfData = {
  horse: RecordPdfHorse
  customer: RecordPdfCustomer
  seller: RecordPdfSeller
  record: RecordPdfRecord
  photos: RecordPdfPhoto[]
}
