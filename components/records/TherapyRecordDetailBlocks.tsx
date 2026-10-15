import { sanitizeUserHtml } from '@/lib/sanitizeUserHtml'
import type { TherapyDisplay } from '@/lib/modules/therapyPayloadDisplay'
import { BODY_MAP_VIEWS } from '@/lib/modules/bodyMapTemplates'

function viewLabel(view: string): string {
  return BODY_MAP_VIEWS.find((v) => v.id === view)?.label ?? view
}

function markerColor(type: string): string {
  if (type === 'pain') return 'bg-red-500'
  if (type === 'treatment') return 'bg-blue-500'
  if (type === 'note') return 'bg-amber-500'
  return 'bg-primary'
}

type Props = {
  therapy: TherapyDisplay
  sectionStart?: number
}

/**
 * Detailblöcke für Therapie-Docs (Abschnitte + vereinfachte Körperkarte).
 */
export default function TherapyRecordDetailBlocks({ therapy, sectionStart = 1 }: Props) {
  let idx = sectionStart - 1
  const next = () => {
    idx += 1
    return idx
  }

  const markers = therapy.bodyMap?.markers ?? []
  const byView = new Map<string, typeof markers>()
  for (const m of markers) {
    const list = byView.get(m.view) ?? []
    list.push(m)
    byView.set(m.view, list)
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#E5E2DC] bg-white px-5 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
          {therapy.moduleLabel}
        </div>
        <p className="mt-1 text-[13px] text-[#6B7280]">Therapie-Dokumentation</p>
      </div>

      {therapy.sections.map((section) => (
        <div key={section.id} className="content-card content-card--lg overflow-hidden">
          <div className="border-b border-[#E5E2DC] px-5 py-4">
            <h2 className="text-[15px] font-semibold text-[#1B1F23]">
              {next()}. {section.title}
            </h2>
          </div>
          <div className="space-y-4 px-5 py-4">
            {section.fields.map((field) => (
              <div key={field.id}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                  {field.label}
                </div>
                <div
                  className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-[#1B1F23] [&_p]:mb-2 [&_p:last-child]:mb-0"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeUserHtml(
                      field.value.includes('<')
                        ? field.value
                        : field.value
                            .split(/\n{2,}/)
                            .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
                            .join('')
                    ),
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {markers.length > 0 ? (
        <div className="content-card content-card--lg overflow-hidden">
          <div className="border-b border-[#E5E2DC] px-5 py-4">
            <h2 className="text-[15px] font-semibold text-[#1B1F23]">
              {next()}. Körperkarte
            </h2>
          </div>
          <div className="space-y-4 px-5 py-4">
            {[...byView.entries()].map(([view, list]) => (
              <div key={view}>
                <p className="mb-2 text-[12px] font-medium text-[#6B7280]">
                  {viewLabel(view)} · {list.length} Markierung(en)
                </p>
                <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-xl border border-[#E5E2DC] bg-[#F8F7F4]">
                  {list.map((m) => (
                    <span
                      key={m.id}
                      title={[m.findingText, m.treatmentText].filter(Boolean).join(' · ') || m.markerType}
                      className={`absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ${markerColor(m.markerType)}`}
                      style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
                    />
                  ))}
                </div>
                <ul className="mt-2 space-y-1">
                  {list.map((m, i) => (
                    <li key={m.id} className="text-[13px] text-[#374151]">
                      <span className="font-medium text-[#1B1F23]">{i + 1}.</span>{' '}
                      {m.findingText || m.treatmentText || m.markerType}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
