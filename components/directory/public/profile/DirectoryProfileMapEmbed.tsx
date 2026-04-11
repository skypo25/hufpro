'use client'

import { DirectoryListingMapboxMap } from '@/components/directory/public/listing/DirectoryListingMapboxMap'
import { profileInitials } from '@/lib/directory/public/profileDisplay'

/** Nur serialisierbare Props von der Server-Profilseite — keine Event-Handler über die Grenze. */
export function DirectoryProfileMapEmbed(props: {
  profileId: string
  slug: string
  displayName: string
  lat: number
  lng: number
  city: string | null
  state: string | null
  radiusKm: number | null
}) {
  const subtitle = [props.city, props.state].filter(Boolean).join(', ') || 'Profil'
  const serviceRadius =
    props.radiusKm != null && Number.isFinite(props.radiusKm) && props.radiusKm > 0
      ? { lat: props.lat, lng: props.lng, radiusKm: props.radiusKm }
      : null

  return (
    <div className="dir-prof-v2-map-embed">
      <DirectoryListingMapboxMap
        points={[
          {
            id: props.profileId,
            lat: props.lat,
            lng: props.lng,
            initials: profileInitials(props.displayName),
            title: props.displayName,
            subtitle,
            href: `/behandler/${props.slug}`,
          },
        ]}
        searchCenter={null}
        activeId={props.profileId}
        serviceRadius={serviceRadius}
        mapAriaLabel={`Standort ${props.displayName}`}
        scrollZoom={false}
      />
    </div>
  )
}
