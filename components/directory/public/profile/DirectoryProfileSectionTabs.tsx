'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export function DirectoryProfileSectionTabs({ tabs }: { tabs: { id: string; label: string }[] }) {
  const ids = useMemo(() => tabs.map((t) => t.id), [tabs])
  const [active, setActive] = useState(tabs[0]?.id ?? '')
  const [pinned, setPinned] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const measure = useCallback(() => {
    const wrap = wrapRef.current
    if (wrap) {
      setPinned(wrap.getBoundingClientRect().top <= 0.5)
    }
    let current = ids[0] ?? ''
    for (const id of ids) {
      const el = document.getElementById(id)
      if (!el) continue
      const top = el.getBoundingClientRect().top
      if (top <= 160) current = id
    }
    setActive(current)
  }, [ids])

  useEffect(() => {
    measure()
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure, { passive: true })
    return () => {
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [measure])

  if (tabs.length === 0) return null

  return (
    <div
      ref={wrapRef}
      className={`dir-prof-v2-tabs-track${pinned ? ' dir-prof-v2-tabs-track--pinned' : ''}`}
    >
      <div className="dir-prof-v2-tabs-in">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`dir-prof-v2-tab${active === t.id ? ' dir-prof-v2-tab--on' : ''}`}
            onClick={() => {
              setActive(t.id)
              const el = document.getElementById(t.id)
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
