'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
/** Nur 15-Minuten-Schritte */
const MINUTES = ['00', '15', '30', '45'] as const

function snapToQuarter(hourStr: string, minuteStr: string): { h: string; m: string } {
  let h = parseInt(hourStr, 10)
  let m = parseInt(minuteStr, 10)
  if (Number.isNaN(h)) h = 9
  if (Number.isNaN(m)) m = 0
  h = Math.max(0, Math.min(23, h))
  let snapped = Math.round(m / 15) * 15
  if (snapped === 60) {
    h = (h + 1) % 24
    snapped = 0
  }
  return { h: String(h).padStart(2, '0'), m: String(snapped).padStart(2, '0') }
}
const ROW_HEIGHT = 40
const VISIBLE_ROWS = 6
const DROPDOWN_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS

type TimePickerProps = {
  value: string
  onChange: (value: string) => void
  id?: string
  className?: string
  placeholder?: string
  disabled?: boolean
}

export default function TimePicker({
  value,
  onChange,
  id,
  className = '',
  placeholder = '--:--',
  disabled = false,
}: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const [hour, setHour] = useState(() => {
    if (value && /^\d{2}:\d{2}/.test(value)) {
      const s = snapToQuarter(value.slice(0, 2), value.slice(3, 5))
      return s.h
    }
    return '09'
  })
  const [minute, setMinute] = useState(() => {
    if (value && /^\d{2}:\d{2}/.test(value)) {
      return snapToQuarter(value.slice(0, 2), value.slice(3, 5)).m
    }
    return '00'
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const hourListRef = useRef<HTMLDivElement>(null)
  const minuteListRef = useRef<HTMLDivElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null)

  const syncFromValue = useCallback(
    (v: string) => {
      if (v && /^\d{2}:\d{2}/.test(v)) {
        const { h, m } = snapToQuarter(v.slice(0, 2), v.slice(3, 5))
        setHour(h)
        setMinute(m)
        const normalized = `${h}:${m}`
        if (normalized !== v.slice(0, 5)) {
          onChange(normalized)
        }
      }
    },
    [onChange]
  )

  useEffect(() => {
    syncFromValue(value)
  }, [value, syncFromValue])

  const commit = useCallback(
    (h: string, m: string) => {
      const next = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
      onChange(next)
    },
    [onChange]
  )

  useEffect(() => {
    if (!open) {
      setDropdownPosition(null)
      return
    }
    const btn = buttonRef.current
    if (btn) {
      const rect = btn.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      })
    }
  }, [open])

  useEffect(() => {
    if (!open || !dropdownPosition) return
    const scrollSelected = () => {
      const hourIdx = HOURS.indexOf(hour)
      const minuteIdx = MINUTES.indexOf(minute)
      if (hourListRef.current && hourIdx >= 0) {
        hourListRef.current.scrollTop = Math.max(0, hourIdx * ROW_HEIGHT - (DROPDOWN_HEIGHT / 2 - ROW_HEIGHT / 2))
      }
      if (minuteListRef.current && minuteIdx >= 0) {
        minuteListRef.current.scrollTop = Math.max(0, minuteIdx * ROW_HEIGHT - (DROPDOWN_HEIGHT / 2 - ROW_HEIGHT / 2))
      }
    }
    const t = requestAnimationFrame(() => scrollSelected())
    return () => cancelAnimationFrame(t)
  }, [open, dropdownPosition, hour, minute])

  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      const portal = document.getElementById('time-picker-portal')
      if (portal?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const display = value || (open ? `${hour}:${minute}` : '')

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`flex w-full items-center rounded-lg border border-[#E5E2DC] bg-white px-4 py-2.5 text-left text-[14px] text-[#1B1F23] outline-none transition focus:border-[#154226] focus:ring-2 focus:ring-[#154226]/20 disabled:opacity-50 ${className}`}
      >
        <span className={value ? '' : 'text-[#9CA3AF]'}>{display || placeholder}</span>
      </button>

      {open &&
        dropdownPosition &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            id="time-picker-portal"
            className="fixed z-[100] flex rounded-xl border border-[#E5E2DC] bg-white shadow-lg"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
            }}
            role="listbox"
          >
            <div
              ref={hourListRef}
              className="flex-1 overflow-y-auto rounded-l-xl px-1 py-1"
              style={{ maxHeight: DROPDOWN_HEIGHT }}
            >
              {HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  role="option"
                  aria-selected={h === hour}
                  onClick={() => {
                    setHour(h)
                    commit(h, minute)
                  }}
                  className={`flex w-full items-center justify-center rounded-lg text-[14px] font-medium transition ${
                    h === hour ? 'bg-[#154226] text-white' : 'text-[#1B1F23] hover:bg-[#edf3ef]'
                  }`}
                  style={{ height: ROW_HEIGHT, minHeight: ROW_HEIGHT }}
                >
                  {h}
                </button>
              ))}
            </div>
            <div
              ref={minuteListRef}
              className="flex-1 overflow-y-auto border-l border-[#E5E2DC] rounded-r-xl px-1 py-1"
              style={{ maxHeight: DROPDOWN_HEIGHT }}
            >
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="option"
                  aria-selected={m === minute}
                  onClick={() => {
                    setMinute(m)
                    commit(hour, m)
                  }}
                  className={`flex w-full items-center justify-center rounded-lg text-[14px] font-medium transition ${
                    m === minute ? 'bg-[#154226] text-white' : 'text-[#1B1F23] hover:bg-[#edf3ef]'
                  }`}
                  style={{ height: ROW_HEIGHT, minHeight: ROW_HEIGHT }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
