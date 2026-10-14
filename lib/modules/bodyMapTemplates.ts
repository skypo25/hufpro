/**
 * Versionierte Körperkarten-Vorlagen (Platzhalter).
 * Markierungen speichern template_id + template_version + relative x/y (0–1).
 */

export type BodyMapAnimal = 'horse' | 'dog' | 'cat'
export type BodyMapView = 'left' | 'right' | 'front' | 'back'

export type BodyMapTemplateMeta = {
  templateId: string
  version: number
  animal: BodyMapAnimal
  view: BodyMapView
  label: string
}

export type BodyMapMarkerType = 'finding' | 'treatment' | 'pain' | 'note'

export type BodyMapMarker = {
  id: string
  view: BodyMapView
  templateId: string
  templateVersion: number
  /** Normalisiert 0–1 relativ zur Vorlage */
  x: number
  y: number
  markerType: BodyMapMarkerType
  findingText: string
  treatmentText: string
  updatedAt: string
}

export type BodyMapState = {
  animal: BodyMapAnimal
  markers: BodyMapMarker[]
}

export const BODY_MAP_VIEWS: { id: BodyMapView; label: string }[] = [
  { id: 'left', label: 'Links' },
  { id: 'right', label: 'Rechts' },
  { id: 'front', label: 'Vorne' },
  { id: 'back', label: 'Hinten' },
]

export const BODY_MAP_MARKER_TYPES: { id: BodyMapMarkerType; label: string }[] = [
  { id: 'finding', label: 'Befund' },
  { id: 'treatment', label: 'Behandlung' },
  { id: 'pain', label: 'Schmerz/Empfindlich' },
  { id: 'note', label: 'Notiz' },
]

const ANIMAL_LABEL: Record<BodyMapAnimal, string> = {
  horse: 'Pferd',
  dog: 'Hund',
  cat: 'Katze',
}

/** Aktuelle Vorlagenversionen — bei Grafik-Austausch erhöhen, alte Docs behalten ihre Version. */
export const BODY_MAP_TEMPLATE_VERSION = 1

export function bodyMapTemplateId(animal: BodyMapAnimal, view: BodyMapView): string {
  return `bodymap_${animal}_${view}_v${BODY_MAP_TEMPLATE_VERSION}`
}

export function getBodyMapTemplateMeta(
  animal: BodyMapAnimal,
  view: BodyMapView
): BodyMapTemplateMeta {
  return {
    templateId: bodyMapTemplateId(animal, view),
    version: BODY_MAP_TEMPLATE_VERSION,
    animal,
    view,
    label: `${ANIMAL_LABEL[animal]} · ${BODY_MAP_VIEWS.find((v) => v.id === view)?.label ?? view}`,
  }
}

export function isBodyMapAnimal(value: string | null | undefined): value is BodyMapAnimal {
  return value === 'horse' || value === 'dog' || value === 'cat'
}
