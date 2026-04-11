'use client'

import { DirectoryListingMapboxMap } from '@/components/directory/public/listing/DirectoryListingMapboxMap'
import { profileInitials } from '@/lib/directory/public/profileDisplay'

const PREVIEW_ID = 'wizard-map-preview'

type Props = {
  latitude: number | null
  longitude: number | null
  radiusKm: number
  title: string
  cityLine: string
}

export function DirectoryWizardMapPreview({ latitude, longitude, radiusKm, title, cityLine }: Props) {
  const hasGeo =
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)

  if (!hasGeo) {
    return (
      <div className="map-placeholder">
        <i className="bi bi-map" />
        <span>
          Wähle in Schritt 1 eine Adresse mit Vorschlag — dann erscheint hier die Karte mit deinem Einsatzradius.
        </span>
      </div>
    )
  }

  const label = title.trim() || 'Standort'

  return (
    <div className="wizard-map-embed">
      <DirectoryListingMapboxMap
        points={[
          {
            id: PREVIEW_ID,
            lat: latitude,
            lng: longitude,
            initials: profileInitials(label),
            title: label,
            subtitle: cityLine.trim() || 'Einsatzgebiet',
            href: '#',
          },
        ]}
        searchCenter={null}
        activeId={PREVIEW_ID}
        serviceRadius={{ lat: latitude, lng: longitude, radiusKm }}
        mapAriaLabel="Vorschau Einsatzgebiet"
        rootClassName="wizard-map-embed__map"
        scrollZoom={false}
      />
    </div>
  )
}
