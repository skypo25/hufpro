/** Geteilte Typen für die Listing-Karte (Mapbox) — nur Daten, kein Karten-SDK-Import. */
export type DirectoryListingMapPoint = {
  id: string
  lat: number
  lng: number
  initials: string
  title: string
  subtitle: string
  href: string
}
