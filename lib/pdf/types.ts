/**
 * Datenmodell für die PDF-Erzeugung einer Hufdokumentation.
 */

export type RecordPdfHorse = {
  name: string
  breed: string | null
  sex: string | null
  birthYear: number | null
  /** Berechnetes Alter in Jahren (optional) */
  ageYears?: number | null
}

export type RecordPdfCustomer = {
  customerNumber: number | null
  name: string
  stableName: string | null
  city: string | null
}

export type RecordPdfRecord = {
  recordDate: string | null
  /** Terminart, falls gespeichert – sonst leer */
  recordType: string | null
  hoofCondition: string | null
  treatment: string | null
  notes: string | null
}

export type RecordPdfPhoto = {
  photoType: string
  label: string
  /** Data URL (data:image/jpeg;base64,...) für Einbettung im PDF */
  dataUrl: string
}

export type RecordPdfData = {
  horse: RecordPdfHorse
  customer: RecordPdfCustomer
  record: RecordPdfRecord
  photos: RecordPdfPhoto[]
}
