'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function RouteLoader() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [fading, setFading] = useState(false)
  const didMount = useRef(false)

  useEffect(() => {
    // Don't show on initial mount (avoids "white screen → loader" on first load).
    if (!didMount.current) {
      didMount.current = true
      return
    }
    // Show loader on route change
    setFading(false)
    setVisible(true)

    const t1 = setTimeout(() => {
      setFading(true)
      const t2 = setTimeout(() => setVisible(false), 350)
      return () => clearTimeout(t2)
    }, 400)

    return () => clearTimeout(t1)
  }, [pathname])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8f8f8',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.35s ease',
        pointerEvents: fading ? 'none' : 'all',
      }}
    >
      <div className="route-loader-inner">
        <div className="route-loader-logo">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="100%" height="100%">
            <path fill="#006d6d" d="M116.74 178.5H63.26c-33.97 0-61.76-27.79-61.76-61.76V63.26C1.5 29.29 29.29 1.5 63.26 1.5h53.48c33.97 0 61.76 27.79 61.76 61.76v53.48c0 33.97-27.79 61.76-61.76 61.76"/>
            <path fill="#000" d="M96.5 74.06v3.23c-1.22-1.03-2.6-1.91-4.16-2.59-2.51-1.09-5.29-1.64-8.33-1.64-4.5 0-8.49 1.08-12 3.22-3.5 2.15-6.25 5.14-8.23 8.97s-2.97 8.2-2.97 13.09c0 4.83.99 9.14 2.97 12.94s4.72 6.79 8.23 8.97q5.25 3.27 12 3.27c3.04 0 5.81-.56 8.33-1.69 1.57-.7 2.94-1.59 4.16-2.61v3.3h16.95V74.06zm-8.83 34.11q-2.67 0-4.86-1.29a8.85 8.85 0 0 1-3.37-3.52c-.79-1.48-1.19-3.19-1.19-5.1 0-1.85.41-3.52 1.24-5.01a9.27 9.27 0 0 1 3.37-3.52c1.42-.86 3.06-1.29 4.91-1.29s3.48.43 4.91 1.29A9.07 9.07 0 0 1 96 93.2c.79 1.45 1.19 3.14 1.19 5.05 0 2.91-.88 5.29-2.63 7.14s-4.05 2.78-6.89 2.78"/>
          </svg>
        </div>
        <div className="route-loader-dots">
          <span /><span /><span />
        </div>
      </div>
    </div>
  )
}
