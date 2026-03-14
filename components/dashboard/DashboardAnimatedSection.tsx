'use client'

import { useEffect, useRef, useState } from 'react'

type DashboardAnimatedSectionProps = {
  children: React.ReactNode
  /** Delay in ms before animation starts (for stagger) */
  delay?: number
  className?: string
}

export default function DashboardAnimatedSection({
  children,
  delay = 0,
  className = '',
}: DashboardAnimatedSectionProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisible(true)
      },
      { threshold: 0.05, rootMargin: '0px 0px -20px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ease-out opacity-0 -translate-y-3 ${visible ? 'opacity-100 translate-y-0' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}
