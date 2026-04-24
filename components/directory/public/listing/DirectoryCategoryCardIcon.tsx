'use client'

import { useEffect, useMemo, useState } from 'react'

import { directorySpecialtyInlineSvgs } from '@/components/directory/icons/specialty/directorySpecialtyInline'
import { categoryCardBiIconClass } from '@/lib/directory/public/categoryCardIcon'

/**
 * Fachrichtung: bekannte Codes als **inline-`<svg>`** (React-Komponenten), sonst `public/directory/{code}.svg` per `<img>`.
 */
export function DirectoryCategoryCardIcon({
  code,
  imgClassName = 'cat-icon-img',
  iconClassName,
}: {
  code: string
  imgClassName?: string
  iconClassName?: string
}) {
  const [useBi, setUseBi] = useState(false)
  const c = (code ?? '').trim().toLowerCase()
  const [inlineSvg, setInlineSvg] = useState<string | null>(null)

  const svgUrl = useMemo(() => `/directory/${code}.svg`, [code])

  if (useBi) {
    const bi = categoryCardBiIconClass(code)
    return <i className={['bi', bi, iconClassName].filter(Boolean).join(' ')} aria-hidden />
  }

  const Cmp = directorySpecialtyInlineSvgs[c]
  if (Cmp) {
    return <Cmp className={imgClassName} aria-hidden focusable="false" fill="currentColor" />
  }

  useEffect(() => {
    let cancelled = false
    setInlineSvg(null)
    fetch(svgUrl, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.text() : null))
      .then((txt) => {
        if (cancelled) return
        if (!txt || !txt.includes('<svg')) {
          setUseBi(true)
          return
        }
        setInlineSvg(txt)
      })
      .catch(() => {
        if (!cancelled) setUseBi(true)
      })
    return () => {
      cancelled = true
    }
  }, [svgUrl])

  if (inlineSvg) {
    return (
      <span
        className={imgClassName}
        aria-hidden
        // SVGs stammen aus `public/` (same origin). Inline erlaubt CSS-Färbung per currentColor.
        dangerouslySetInnerHTML={{ __html: inlineSvg }}
      />
    )
  }

  return (
    <img
      src={svgUrl}
      alt=""
      className={imgClassName}
      onError={() => setUseBi(true)}
      loading="lazy"
      decoding="async"
    />
  )
}
