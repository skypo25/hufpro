'use client'

import { useState } from 'react'

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

  if (useBi) {
    const bi = categoryCardBiIconClass(code)
    return <i className={['bi', bi, iconClassName].filter(Boolean).join(' ')} aria-hidden />
  }

  const Cmp = directorySpecialtyInlineSvgs[c]
  if (Cmp) {
    return <Cmp className={imgClassName} aria-hidden focusable="false" fill="currentColor" />
  }

  return (
    <img
      src={`/directory/${code}.svg`}
      alt=""
      className={imgClassName}
      onError={() => setUseBi(true)}
      loading="lazy"
      decoding="async"
    />
  )
}
