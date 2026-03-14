'use client'

import { useEffect, useState } from 'react'

/** Ease-out: schnell starten, am Ende langsamer */
function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4)
}

type CountUpProps = {
  value: number
  duration?: number
  delay?: number
  startOnView?: boolean
  /** Element ID for IntersectionObserver when startOnView is true; default "dashboard-stats-grid" */
  observerId?: string
}

export default function CountUp({
  value,
  duration = 1400,
  delay = 0,
  startOnView = true,
  observerId = 'dashboard-stats-grid',
}: CountUpProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const [hasStarted, setHasStarted] = useState(!startOnView)

  useEffect(() => {
    if (!startOnView) {
      setHasStarted(true)
      return
    }

    const el = document.getElementById(observerId)
    if (!el) {
      setHasStarted(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setHasStarted(true)
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [startOnView, observerId])

  useEffect(() => {
    if (!hasStarted) return

    const startTime = Date.now() + delay
    let rafId: number

    function tick() {
      const now = Date.now()
      if (now < startTime) {
        rafId = requestAnimationFrame(tick)
        return
      }
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = easeOutQuart(progress)
      const current = Math.round(eased * value)
      setDisplayValue(current)
      if (progress < 1) {
        rafId = requestAnimationFrame(tick)
      }
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [hasStarted, value, duration, delay])

  return <span>{displayValue.toLocaleString('de-DE')}</span>
}
