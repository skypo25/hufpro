'use client'

import { useEffect, useState } from 'react'

export default function Preloader() {
  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    // Keep this splash short; the app already has real data loaders.
    const t1 = setTimeout(() => {
      setFading(true)
      const t2 = setTimeout(() => setVisible(false), 600)
      return () => clearTimeout(t2)
    }, 450)
    return () => clearTimeout(t1)
  }, [])

  if (!visible) return null

  return (
    <div className="splash-overlay" style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.6s ease' }}>
      <div className="splash-inner">
        {/* Logo */}
        <div className="splash-logo">
          <img
            src="/icon.png"
            alt=""
            width={80}
            height={80}
            fetchPriority="high"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        </div>

        {/* Brand name */}
        <div className="splash-brand">anidocs</div>

        {/* Tagline */}
        <div className="splash-tagline">Dokumentation für Tiertherapeuten</div>

        {/* Dots */}
        <div className="splash-dots">
          <span /><span /><span />
        </div>
      </div>

      {/* Bottom */}
      <div className="splash-bottom">Made in Germany</div>
    </div>
  )
}
