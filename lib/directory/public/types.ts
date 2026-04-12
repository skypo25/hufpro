/** Zeilen aus Postgres-Views (Public Read). */

export type DirectoryPublicProfileRow = {
  id: string
  slug: string
  display_name: string
  practice_name: string | null
  /** Wenn in View exponiert: für Kurzinfo ohne Firmenname. */
  first_name?: string | null
  last_name?: string | null
  short_description: string | null
  description: string | null
  street: string | null
  /** Import/Wizard: oft getrennt von street; nach View-Migration immer gesetzt (sonst fehlend/undefined). */
  house_number?: string | null
  postal_code: string | null
  city: string | null
  state: string | null
  country: string
  service_type: 'stationary' | 'mobile' | 'both'
  service_area_text: string | null
  service_radius_km: string | null
  /** 'verified' wird im Listing als Badge/Icon genutzt (wenn in View exponiert). */
  verification_state?: 'none' | 'pending' | 'verified' | 'rejected' | string | null
  /** Top-Profil aktiv (abgeleitet aus Entitlements in Public-View). */
  top_active?: boolean | null
  /** Top aktiv + hinterlegte Kontakt-E-Mail: öffentliches Kontaktformular erlaubt (E-Mail wird nicht exponiert). */
  premium_contact_enabled?: boolean | null
  /** ISO timestamp (timestamptz) oder null (max active_until der aktiven Entitlements). */
  top_until?: string | null
  /** Aktive Quellen (z.B. ['app_subscription','directory_subscription']). */
  top_sources?: string[] | null
  /** ISO timestamp; null if View noch nicht migriert (Fallback Sortierung nach display_name). */
  created_at?: string | null
  /** Nur wenn in Public-View exponiert und gesetzt (Umkreissuche). */
  latitude?: number | null
  longitude?: number | null
  /** Aus directory_profiles; bei `claimed` kein Claim-CTA auf der Profilseite. */
  claim_state?: 'unclaimed' | 'claim_pending' | 'claimed' | string | null
  /** Wöchentliche Öffnungszeiten (JSON), siehe `lib/directory/openingHours.ts`. */
  opening_hours?: unknown | null
  /** Freitext: Erreichbarkeit, Abweichungen, Feiertage. */
  opening_hours_note?: string | null
  /** Öffentliche Telefonnummer (wenn in View exponiert). */
  phone_public?: string | null
}

/** Ergebnis von fetchSimilarPublicProfiles — Primärfach-Label für Karten. */
export type DirectoryPublicSimilarProfileRow = DirectoryPublicProfileRow & {
  primary_specialty_label: string | null
}

export type DirectoryPublicSpecialtyRow = {
  id: string
  code: string
  name: string
  description: string | null
  sort_order: number
  parent_specialty_id: string | null
}

export type DirectoryPublicAnimalTypeRow = {
  id: string
  code: string
  name: string
  sort_order: number
}

export type DirectoryPublicProfileSpecialtyRow = {
  id: string
  directory_profile_id: string
  directory_specialty_id: string
  is_primary: boolean
}

export type DirectoryPublicProfileAnimalRow = {
  id: string
  directory_profile_id: string
  directory_animal_type_id: string
}

export type DirectoryPublicProfileMediaRow = {
  id: string
  directory_profile_id: string
  media_type: string
  url: string | null
  sort_order: number
  alt_text: string | null
}

export type DirectoryPublicProfileSocialRow = {
  id: string
  directory_profile_id: string
  platform: string
  url: string
  sort_order: number
}

/** `directory_public_subcategories` */
export type DirectoryPublicSubcategoryRow = {
  id: string
  code: string
  name: string
  directory_specialty_id: string
  /** Kanonischer Fachrichtungs-Code (JOIN directory_specialties); UI-Gruppierung. */
  directory_specialty_code: string
  sort_order: number
}

/** `directory_public_methods` */
export type DirectoryPublicMethodRow = {
  id: string
  code: string
  name: string
  directory_specialty_id: string | null
  /** Gesetzt wenn directory_specialty_id gesetzt und Fachrichtung aktiv. */
  directory_specialty_code: string | null
  sort_order: number
}

/** `directory_public_profile_subcategories` */
export type DirectoryPublicProfileSubcategoryRow = {
  id: string
  directory_profile_id: string
  directory_subcategory_id: string
}

/** `directory_public_profile_methods` */
export type DirectoryPublicProfileMethodRow = {
  id: string
  directory_profile_id: string
  directory_method_id: string
}
