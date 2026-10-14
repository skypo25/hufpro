'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  BODY_MAP_MARKER_TYPES,
  BODY_MAP_VIEWS,
  bodyMapTemplateId,
  BODY_MAP_TEMPLATE_VERSION,
  getBodyMapTemplateMeta,
  type BodyMapAnimal,
  type BodyMapMarker,
  type BodyMapMarkerType,
  type BodyMapState,
  type BodyMapView,
} from '@/lib/modules/bodyMapTemplates'
import BodyMapPlaceholderSvg from '@/components/bodyMap/BodyMapPlaceholderSvg'

export type { BodyMapState }

type Props = {
  animalType: BodyMapAnimal
  value: BodyMapState | null
  onChange: (next: BodyMapState) => void
}

function uid() {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export default function BodyMapEditor({ animalType, value, onChange }: Props) {
  const [view, setView] = useState<BodyMapView>('left')
  const [markerType, setMarkerType] = useState<BodyMapMarkerType>('finding')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const state: BodyMapState = value ?? { animal: animalType, markers: [] }
  const markers = state.markers.filter((m) => m.view === view)
  const selected = state.markers.find((m) => m.id === selectedId) ?? null
  const meta = useMemo(() => getBodyMapTemplateMeta(animalType, view), [animalType, view])

  const commit = useCallback(
    (markersNext: BodyMapMarker[]) => {
      onChange({ animal: animalType, markers: markersNext })
    },
    [animalType, onChange]
  )

  const updateMarker = useCallback(
    (id: string, patch: Partial<BodyMapMarker>) => {
      commit(
        state.markers.map((m) =>
          m.id === id ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m
        )
      )
    },
    [commit, state.markers]
  )

  const deleteMarker = useCallback(
    (id: string) => {
      commit(state.markers.filter((m) => m.id !== id))
      if (selectedId === id) setSelectedId(null)
    },
    [commit, state.markers, selectedId]
  )

  const onCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (draggingId) return
      const rect = e.currentTarget.getBoundingClientRect()
      const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
      const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
      const marker: BodyMapMarker = {
        id: uid(),
        view,
        templateId: bodyMapTemplateId(animalType, view),
        templateVersion: BODY_MAP_TEMPLATE_VERSION,
        x,
        y,
        markerType,
        findingText: '',
        treatmentText: '',
        updatedAt: new Date().toISOString(),
      }
      commit([...state.markers, marker])
      setSelectedId(marker.id)
    },
    [draggingId, view, animalType, markerType, commit, state.markers]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingId) return
      const rect = e.currentTarget.getBoundingClientRect()
      const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
      const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
      updateMarker(draggingId, { x, y })
    },
    [draggingId, updateMarker]
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {BODY_MAP_VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className={[
              'rounded-lg border px-3 py-1.5 text-[13px] font-medium',
              view === v.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-[#E5E2DC] text-[#1B1F23]',
            ].join(' ')}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {BODY_MAP_MARKER_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMarkerType(t.id)}
            className={[
              'rounded-full border px-3 py-1 text-[12px]',
              markerType === t.id
                ? 'border-primary bg-primary text-white'
                : 'border-[#E5E2DC] text-[#6B7280]',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-[12px] text-[#9CA3AF]">
        Vorlage {meta.templateId} · Antippen setzt Markierung · Ziehen verschiebt
      </p>

      <div
        className="relative mx-auto aspect-[4/3] w-full max-w-xl touch-none select-none overflow-hidden rounded-xl border border-[#E5E2DC] bg-[#F8F7F4]"
        onClick={onCanvasClick}
        onPointerMove={onPointerMove}
        onPointerUp={() => setDraggingId(null)}
        onPointerLeave={() => setDraggingId(null)}
      >
        <BodyMapPlaceholderSvg animal={animalType} view={view} className="h-full w-full" />
        {markers.map((m) => (
          <button
            key={m.id}
            type="button"
            className={[
              'absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow',
              selectedId === m.id ? 'ring-2 ring-primary' : '',
              m.markerType === 'pain'
                ? 'bg-red-500'
                : m.markerType === 'treatment'
                  ? 'bg-blue-500'
                  : m.markerType === 'note'
                    ? 'bg-amber-500'
                    : 'bg-primary',
            ].join(' ')}
            style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
            onClick={(e) => {
              e.stopPropagation()
              setSelectedId(m.id)
            }}
            onPointerDown={(e) => {
              e.stopPropagation()
              e.currentTarget.setPointerCapture(e.pointerId)
              setDraggingId(m.id)
              setSelectedId(m.id)
            }}
            aria-label="Markierung"
          />
        ))}
      </div>

      {selected ? (
        <div className="space-y-3 rounded-xl border border-[#E5E2DC] bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[13px] font-medium text-[#1B1F23]">
              Markierung ({selected.markerType})
            </div>
            <button
              type="button"
              className="text-[13px] font-medium text-red-600"
              onClick={() => deleteMarker(selected.id)}
            >
              Löschen
            </button>
          </div>
          <label className="block text-[12px] text-[#6B7280]">
            Befund
            <textarea
              className="mt-1 w-full rounded-lg border border-[#E5E2DC] px-3 py-2 text-[14px]"
              rows={2}
              value={selected.findingText}
              onChange={(e) => updateMarker(selected.id, { findingText: e.target.value })}
            />
          </label>
          <label className="block text-[12px] text-[#6B7280]">
            Behandlung
            <textarea
              className="mt-1 w-full rounded-lg border border-[#E5E2DC] px-3 py-2 text-[14px]"
              rows={2}
              value={selected.treatmentText}
              onChange={(e) => updateMarker(selected.id, { treatmentText: e.target.value })}
            />
          </label>
        </div>
      ) : (
        <p className="text-[13px] text-[#9CA3AF]">Tippe auf die Darstellung, um eine Markierung zu setzen.</p>
      )}
    </div>
  )
}
