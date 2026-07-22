'use client'

import './mobileRouteLoading.css'

type MobileRouteLoadingProps = {
  /** Text ohne Punkte, z. B. „Laden“ → wird zu „Laden...“ mit Animation */
  label?: string
}

/** Deutlicher Mobile-Ladezustand mit animierten Punkten. */
export function MobileRouteLoading({ label = 'Laden' }: MobileRouteLoadingProps) {
  return (
    <div className="mrl" role="status" aria-live="polite" aria-busy="true">
      <p className="mrl__text">
        {label}
        <span className="mrl__dots" aria-hidden="true">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </p>
    </div>
  )
}
