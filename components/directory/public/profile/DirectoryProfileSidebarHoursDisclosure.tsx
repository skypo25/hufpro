'use client'

import type { DirectoryWeekdayKey, OpeningHoursDisplayLine } from '@/lib/directory/openingHours'

export function DirectoryProfileSidebarHoursDisclosure({
  lines,
  todayKey,
  note,
}: {
  lines: OpeningHoursDisplayLine[]
  todayKey: DirectoryWeekdayKey
  note: string | null
}) {
  return (
    <details className="dir-prof-v2-sidebar-hours-dtl" open>
      <summary className="dir-prof-v2-sidebar-hours-sum">
        <span className="dir-prof-v2-sidebar-hours-sum-txt">Öffnungszeiten &amp; Erreichbarkeit</span>
        <i className="bi bi-chevron-down dir-prof-v2-sidebar-hours-sum-ic" aria-hidden />
      </summary>
      <div className="dir-prof-v2-sidebar-hours-panel">
        {lines.length > 0 ? (
          <dl className="dir-prof-v2-facts-sidebar-hours-dl">
            {lines.map((line) => (
              <div
                key={line.key}
                className={
                  line.key === todayKey
                    ? 'dir-prof-v2-facts-sidebar-hours-row dir-prof-v2-facts-sidebar-hours-row--today'
                    : 'dir-prof-v2-facts-sidebar-hours-row'
                }
              >
                <dt>{line.label}</dt>
                <dd>{line.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {note ? <p className="dir-prof-v2-facts-sidebar-hours-note">{note}</p> : null}
      </div>
    </details>
  )
}
