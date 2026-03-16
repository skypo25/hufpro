'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

function IconFabPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={24} height={24}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

const FAB_ITEMS: { href: string; label: string }[] = [
  { href: '/appointments/new', label: 'Neuer Termin' },
  { href: '/customers/new', label: 'Neuer Kunde' },
  { href: '/horses/new', label: 'Neues Pferd' },
]

export default function MobileFab() {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        menuRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      ) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="mobile-fab"
        onClick={() => setOpen(!open)}
        title="Menü öffnen"
        aria-label="Menü öffnen"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <IconFabPlus />
      </button>
      {open && (
        <div
          ref={menuRef}
          className="mobile-fab-menu"
          role="menu"
          aria-label="Schnellaktionen"
        >
          {FAB_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="mobile-fab-menu-item"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
