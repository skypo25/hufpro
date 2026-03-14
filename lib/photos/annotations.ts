/**
 * Struktur für gespeicherte Markierungen pro Foto.
 * Alle Koordinaten relativ 0–1 (anteilig zur Bildbreite/-höhe).
 */

export type Point = { x: number; y: number }

export type LineAnnotation = {
  type: 'line'
  points: [Point, Point]
  color?: string
}

export type AxisAnnotation = {
  type: 'axis'
  points: [Point, Point]
  color?: string
}

export type PointAnnotation = {
  type: 'point'
  point: Point
  color?: string
}

export type StrokeAnnotation = {
  type: 'stroke'
  points: Point[]
  color?: string
}

export type AngleAnnotation = {
  type: 'angle'
  /** Drei Punkte: Scheitel, Arm1-Ende, Arm2-Ende */
  points: [Point, Point, Point]
  color?: string
}

export type Annotation =
  | LineAnnotation
  | AxisAnnotation
  | PointAnnotation
  | StrokeAnnotation
  | AngleAnnotation

export type AnnotationsData = {
  version?: number
  items: Annotation[]
}

export const DEFAULT_ANNOTATIONS: AnnotationsData = { version: 1, items: [] }

export function parseAnnotationsJson(json: unknown): AnnotationsData {
  if (!json) return DEFAULT_ANNOTATIONS
  if (typeof json !== 'object' || !('items' in json)) return DEFAULT_ANNOTATIONS
  const obj = json as { items?: unknown[] }
  if (!Array.isArray(obj.items)) return DEFAULT_ANNOTATIONS
  return { version: 1, items: obj.items as Annotation[] }
}
