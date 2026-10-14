import { View, Text, Svg, Circle, StyleSheet } from '@react-pdf/renderer'
import type { BodyMapState } from '@/lib/modules/bodyMapTemplates'

const s = StyleSheet.create({
  wrap: { marginTop: 8 },
  title: { fontSize: 10, fontWeight: 600, marginBottom: 4 },
  row: { fontSize: 8, marginBottom: 2, color: '#374151' },
  canvas: {
    width: 220,
    height: 165,
    borderWidth: 1,
    borderColor: '#E5E2DC',
    marginBottom: 6,
    position: 'relative',
  },
})

/** Vereinfachte PDF-Darstellung der Körperkarten-Markierungen (Koordinaten 0–1). */
export function BodyMapPdfSection({ bodyMap }: { bodyMap: BodyMapState | null | undefined }) {
  if (!bodyMap?.markers?.length) return null
  const byView = new Map<string, typeof bodyMap.markers>()
  for (const m of bodyMap.markers) {
    const list = byView.get(m.view) ?? []
    list.push(m)
    byView.set(m.view, list)
  }

  return (
    <View style={s.wrap}>
      <Text style={s.title}>Körperkarte</Text>
      {[...byView.entries()].map(([view, markers]) => (
        <View key={view} wrap={false}>
          <Text style={s.row}>
            Ansicht: {view} · Vorlage v{markers[0]?.templateVersion ?? '?'}
          </Text>
          <Svg width={220} height={165} style={s.canvas}>
            {markers.map((m) => (
              <Circle
                key={m.id}
                cx={m.x * 220}
                cy={m.y * 165}
                r={4}
                fill={
                  m.markerType === 'pain'
                    ? '#DC2626'
                    : m.markerType === 'treatment'
                      ? '#3B82F6'
                      : '#16A34A'
                }
              />
            ))}
          </Svg>
          {markers.map((m, i) => (
            <Text key={m.id} style={s.row}>
              {i + 1}. [{m.markerType}] {m.findingText || '—'}
              {m.treatmentText ? ` / ${m.treatmentText}` : ''}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}
