/**
 * Rohzeile aus CSV-Export / JSON (Feldnamen konsistent mit Recherche-Template).
 * Alle Felder optional — fehlende Werte werden zu NULL / Defaults normalisiert.
 */
export type DirectoryImportRawRow = {
  praxisname?: string | null
  ansprechpartner_name?: string | null
  fachrichtung?: string | null
  unterkategorie?: string | null
  tierarten?: string | null
  mobil_oder_praxis?: string | null
  strasse?: string | null
  hausnummer?: string | null
  plz?: string | null
  ort?: string | null
  bundesland?: string | null
  telefon?: string | null
  email?: string | null
  website?: string | null
  beschreibung_kurz?: string | null
  einsatzgebiet?: string | null
  qualifikationen?: string | null
  leistungen?: string | null
  verifiziert_status?: string | boolean | null
  profil_status?: string | null
  premium_status?: string | boolean | null
  bilder_vorhanden?: string | boolean | null
  social_instagram?: string | null
  social_facebook?: string | null
  social_linkedin?: string | null
  quellen_url_1?: string | null
  quellen_url_2?: string | null
  quellen_typ?: string | null
  datenqualitaet?: string | null
}

export type DirectoryImportOptions = {
  /** Wenn true: listing_status aus Rohdaten (nur wenn explizit veröffentlichbar), sonst immer draft */
  allowPublishedFromSource: boolean
  /** Trockenlauf: keine DB-Schreibzugriffe */
  dryRun: boolean
  /** Name für directory_import_batches.name */
  batchName: string
  /** Optional: User-UUID für created_by_user_id */
  createdByUserId?: string | null
}

export type ServiceType = 'stationary' | 'mobile' | 'both'
