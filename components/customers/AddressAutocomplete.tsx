'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const PHOTON_URL = 'https://photon.komoot.io/api'
const DEBOUNCE_MS = 300

export type AddressSuggestion = {
  street: string
  zip: string
  city: string
  country: string
  /** Koordinaten von Photon (für Entfernungsberechnung) */
  lat?: number
  lon?: number
}

type PhotonFeature = {
  type: string
  geometry?: { type: string; coordinates: [number, number] }
  properties: {
    name?: string
    street?: string
    housenumber?: string
    postcode?: string
    city?: string
    locality?: string
    country?: string
    countrycode?: string
  }
}

function countryFromCode(code: string | undefined): string {
  if (!code) return 'Deutschland'
  const map: Record<string, string> = {
    DE: 'Deutschland',
    AT: 'Österreich',
    CH: 'Schweiz',
  }
  return map[code] ?? code
}

/** Sucht im Suchtext nach einer Hausnummer (z. B. 2a, 12, 5b), falls OSM keine liefert. */
function extractHousenumberFromQuery(query: string): string | null {
  const tokens = query.trim().split(/\s+/)
  const match = tokens.find((t) => /^\d+[a-zA-Z]?$/.test(t))
  return match ?? null
}

function featureToAddress(f: PhotonFeature): AddressSuggestion {
  const p = f.properties
  const streetPart = [p.street, p.housenumber].filter(Boolean).join(' ')
  const street = streetPart || p.name || ''
  const city = p.city || p.locality || ''
  const [lon, lat] = f.geometry?.coordinates ?? []
  return {
    street,
    zip: p.postcode || '',
    city,
    country: p.country || countryFromCode(p.countrycode),
    ...(typeof lat === 'number' && typeof lon === 'number' && { lat, lon }),
  }
}

type AddressAutocompleteProps = {
  onSelect: (address: AddressSuggestion) => void
  placeholder?: string
  id?: string
  className?: string
}

export default function AddressAutocomplete({
  onSelect,
  placeholder = 'Adresse oder Firma suchen (z. B. Straße, PLZ Ort, Reiterhof)',
  id,
  className = '',
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchSuggestions = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 3) {
      setSuggestions([])
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams({
        q: trimmed,
        limit: '8',
        lang: 'de',
      })
      const res = await fetch(`${PHOTON_URL}?${params}`)
      const data = await res.json()
      const features: PhotonFeature[] = data?.features ?? []
      const addresses = features.map(featureToAddress).filter((a) => a.street || a.city)
      setSuggestions(addresses)
      setActiveIndex(-1)
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setSuggestions([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(query)
      setOpen(true)
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, fetchSuggestions])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (address: AddressSuggestion) => {
    let finalAddress = { ...address }
    const hasNumberInStreet = /\d/.test(address.street)
    if (!hasNumberInStreet && query.trim()) {
      const extracted = extractHousenumberFromQuery(query)
      if (extracted) {
        finalAddress = { ...address, street: `${address.street} ${extracted}`.trim() }
      }
    }
    onSelect(finalAddress)
    setQuery('')
    setSuggestions([])
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i < suggestions.length - 1 ? i + 1 : i))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i > 0 ? i - 1 : -1))
    } else if (e.key === 'Enter' && activeIndex >= 0 && suggestions[activeIndex]) {
      e.preventDefault()
      handleSelect(suggestions[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        id={id}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.trim().length >= 3 && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={className || 'huf-input w-full'}
        aria-autocomplete="list"
        aria-expanded={open && suggestions.length > 0}
        aria-controls="address-suggestions"
        aria-activedescendant={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#6B7280]">
          Suche…
        </span>
      )}
      {open && suggestions.length > 0 && (
        <ul
          id="address-suggestions"
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-[#E5E2DC] bg-white py-1 shadow-lg"
        >
          {suggestions.map((s, i) => {
            const fromQuery = extractHousenumberFromQuery(query)
            const streetLabel =
              fromQuery && !/\d/.test(s.street) ? `${s.street} ${fromQuery}` : s.street
            const label = [streetLabel, [s.zip, s.city].filter(Boolean).join(' '), s.country]
              .filter(Boolean)
              .join(', ')
            return (
              <li
                key={`${s.street}-${s.zip}-${s.city}-${i}`}
                id={`suggestion-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                className={`cursor-pointer px-3 py-2 text-[13px] ${
                  i === activeIndex ? 'bg-[#edf3ef] text-[#154226]' : 'text-[#1B1F23] hover:bg-[#f7f6f3]'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(s)
                }}
              >
                {label || '—'}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
