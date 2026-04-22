'use client'

import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

/** 96 px · hell — Logo aus anidocs Logo Loader (viewBox 60×60) */
const LETTER_PATH =
  'M32.19,24.84v1.07c-0.4-0.34-0.86-0.63-1.38-0.86c-0.83-0.36-1.75-0.54-2.76-0.54c-1.49,0-2.82,0.36-3.98,1.07s-2.07,1.7-2.73,2.97c-0.66,1.27-0.99,2.72-0.99,4.34c0,1.6,0.33,3.03,0.99,4.29c0.66,1.26,1.57,2.25,2.73,2.97c1.16,0.72,2.49,1.09,3.98,1.09c1.01,0,1.93-0.19,2.76-0.56c0.52-0.23,0.98-0.53,1.38-0.87v1.1h5.62V24.84H32.19zM29.27,36.14c-0.59,0-1.13-0.14-1.61-0.43c-0.48-0.28-0.85-0.67-1.12-1.17c-0.26-0.49-0.39-1.06-0.39-1.69c0-0.61,0.14-1.17,0.41-1.66c0.27-0.49,0.65-0.88,1.12-1.17c0.47-0.28,1.01-0.43,1.63-0.43c0.61,0,1.16,0.14,1.63,0.43c0.47,0.28,0.84,0.67,1.1,1.15c0.26,0.48,0.39,1.04,0.39,1.68c0,0.96-0.29,1.75-0.87,2.37C30.97,35.84,30.21,36.14,29.27,36.14z'

/**
 * Ein globaler Loader: kurzer Start-Splash + Overlay bei Client-Navigation.
 * Ersetzt früheren Preloader + RouteLoader (96 px, heller Hintergrund #f5f9f9).
 */
export default function AnidocsAppLoader() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)
  const skipFirstPathEffect = useRef(true)
  const prevPath = useRef(pathname)

  useEffect(() => {
    let t2: ReturnType<typeof setTimeout> | undefined
    const t1 = setTimeout(() => {
      setFading(true)
      t2 = setTimeout(() => {
        setVisible(false)
        setFading(false)
      }, 600)
    }, 450)
    return () => {
      clearTimeout(t1)
      if (t2) clearTimeout(t2)
    }
  }, [])

  useEffect(() => {
    if (skipFirstPathEffect.current) {
      skipFirstPathEffect.current = false
      prevPath.current = pathname
      return
    }
    if (pathname === prevPath.current) return
    prevPath.current = pathname

    let t2: ReturnType<typeof setTimeout> | undefined
    setFading(false)
    setVisible(true)
    const t1 = setTimeout(() => {
      setFading(true)
      t2 = setTimeout(() => {
        setVisible(false)
        setFading(false)
      }, 350)
    }, 400)
    return () => {
      clearTimeout(t1)
      if (t2) clearTimeout(t2)
    }
  }, [pathname])

  if (!visible) return null

  return (
    <div
      className="anidocs-app-loader-overlay"
      style={{
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.35s ease',
        pointerEvents: fading ? 'none' : 'auto',
      }}
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <div
        className="anidocs-loader"
        style={{ '--size': '96px' } as CSSProperties}
      >
        <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <rect className="anidocs-loader__box" x="1" y="1" width="58" height="58" rx="13.42" ry="13.42" />
          <path className="anidocs-loader__letter" d={LETTER_PATH} />
        </svg>
      </div>
    </div>
  )
}
