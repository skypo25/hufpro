'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useAppProfile } from '@/context/AppProfileContext'
import { newAnimalFabLabel } from '@/lib/appProfile'

function IconFabPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={18} height={18}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export default function MobileFab() {
  const { profile } = useAppProfile()
  const fabItems = useMemo(
    () => [
      { href: '/appointments/new', label: 'Neuer Termin' },
      { href: '/customers/new', label: 'Neuer Kunde' },
      { href: '/horses/new', label: newAnimalFabLabel(profile.terminology) },
    ],
    [profile.terminology]
  )
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
          {fabItems.map((item) => (
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
