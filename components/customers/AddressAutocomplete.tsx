'use client'

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEventHandler } from 'react'
import { flagEmojiFromIso3166Alpha2 } from '@/lib/dachCountryFlags'

const PHOTON_URL = 'https://photon.komoot.io/api'
const DEBOUNCE_MS = 300
/** Photon liefert oft nahezu identische Treffer — etwas mehr holen, dann deduplizieren. */
const PHOTON_FETCH_LIMIT = '14'
/** Max. sichtbare Zeilen (weniger Scroll, klarere Liste). */
const MAX_SUGGESTIONS_SHOWN = 5

export type AddressSuggestion = {
  street: string
  zip: string
  city: string
  country: string
  /** ISO-3166-1 alpha-2 (z. B. DE, AT, CH) — von Photon */
  countryCode?: string
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
    /** GeocodeJSON / Photon */
    type?: string
    osm_key?: string
    osm_value?: string
  }
}

/** Bei Orts-Autocomplete: POIs/Straßen raus, falls Photon trotz layer noch liefert. */
const PHOTON_DISALLOWED_OSM_KEYS = new Set([
  'highway',
  'amenity',
  'leisure',
  'landuse',
  'shop',
  'tourism',
  'building',
  'office',
  'man_made',
  'railway',
  'aeroway',
  'historic',
])

function photonFeatureIsPlaceLike(f: PhotonFeature): boolean {
  const p = f.properties
  const gjType = p.type?.toLowerCase()
  if (gjType === 'house' || gjType === 'street') return false
  const key = (p.osm_key ?? '').toLowerCase()
  if (!key) return true
  if (key === 'place' || key === 'boundary') return true
  return !PHOTON_DISALLOWED_OSM_KEYS.has(key)
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
  const match = tokens.find((t) => {
    if (/^\d{4,6}$/.test(t)) return false
    return /^\d+[a-zA-Z]?$/.test(t)
  })
  return match ?? null
}

function featureToAddress(f: PhotonFeature): AddressSuggestion {
  const p = f.properties
  const streetPart = [p.street, p.housenumber].filter(Boolean).join(' ')
  const street = streetPart || p.name || ''
  const city = p.city || p.locality || ''
  const [lon, lat] = f.geometry?.coordinates ?? []
  const cc = p.countrycode?.trim().toUpperCase()
  return {
    street,
    zip: p.postcode || '',
    city,
    country: p.country || countryFromCode(p.countrycode),
    ...(cc && cc.length === 2 ? { countryCode: cc } : {}),
    ...(typeof lat === 'number' && typeof lon === 'number' && { lat, lon }),
  }
}

/** PLZ steht schon im Namen/Straßen-Teil (z. B. „Dernbach 56307“) — nicht nochmal anhängen. */
function zipAlreadyInStreetLine(streetLine: string, zip: string): boolean {
  const z = zip.trim()
  if (!z || !streetLine) return false
  if (!/^\d{4,6}$/.test(z)) return false
  const esc = z.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[\\s,])${esc}($|[\\s,])`).test(streetLine)
}

/** Ort nicht nochmal nennen, wenn er schon im ersten Teil vorkommt (z. B. Ortsname in `name`). */
function cityRedundantWithStreet(streetLine: string, city: string): boolean {
  const c = city.trim()
  if (!c || !streetLine) return false
  if (c.length < 3) return false
  return streetLine.toLowerCase().includes(c.toLowerCase())
}

/** Zweite Textstufe für Liste & Verzeichnis-String: PLZ/Ort nur wenn nicht schon in Zeile 1. */
function buildCityZipTail(streetLine: string, zip: string, city: string): string {
  const parts: string[] = []
  const z = zip.trim()
  const c = city.trim()
  if (z && !zipAlreadyInStreetLine(streetLine, z)) parts.push(z)
  if (c && !cityRedundantWithStreet(streetLine, c)) parts.push(c)
  return parts.join(' ')
}

function suggestionDedupeKey(a: AddressSuggestion): string {
  const n = (x: string) => x.trim().toLowerCase().replace(/\s+/g, ' ')
  const geo =
    a.lat != null && a.lon != null
      ? `${Math.round(a.lat * 5000) / 5000},${Math.round(a.lon * 5000) / 5000}`
      : ''
  return `${n(a.zip)}|${n(a.city)}|${n(a.street)}|${geo}`
}

/** Einzeiliger Suchort für Verzeichnis (PLZ, Ort, optional Straße) — gleiche Logik wie Vorschlagszeile. */
export function formatAddressSuggestionForLocationQuery(s: AddressSuggestion): string {
  const street = s.street.trim()
  const tail = buildCityZipTail(street, s.zip, s.city)
  if (street && tail) return `${street}, ${tail}`
  if (tail) return tail
  return street || s.city.trim() || s.country || ''
}

type AddressAutocompleteProps = {
  onSelect?: (address: AddressSuggestion) => void
  placeholder?: string
  id?: string
  /** aria-label für das Eingabefeld (wenn kein sichtbares Label). */
  ariaLabel?: string
  className?: string
  /** Kontrolliert: Wert und Änderungen (z. B. Verzeichnis-Suche mit Hidden-Field). */
  value?: string
  onValueChange?: (v: string) => void
  /** Nach Auswahl: Text im Feld behalten (statt leeren). */
  persistQueryOnSelect?: boolean
  /** Photon `bbox=minLon,minLat,maxLon,maxLat` — z. B. D-A-CH einschränken. */
  bbox?: string
  /** Nur Vorschläge mit diesen ISO-3166-1-alpha-2-Codes (Kleinbuchstaben), z. B. `['de','at','ch']`. */
  allowedCountryCodes?: readonly string[]
  /** Photon `layer` (mehrfach) — z. B. nur Orte, keine Straßen. */
  photonLayers?: readonly string[]
  /** Zusätzlich zu Pfeiltasten/Escape (z. B. Enter → Suche auslösen). */
  onInputKeyDown?: KeyboardEventHandler<HTMLInputElement>
  /**
   * Eltern kann bei jeder Suche inkrementieren — schließt die Vorschlagsliste und bricht laufende Debounces ab
   * (z. B. Verzeichnis „Suchen“, damit die Liste nach der Navigation nicht wieder aufgeht).
   */
  dismissSuggestionsSignal?: number
}

export default function AddressAutocomplete({
  onSelect,
  placeholder = 'Adresse oder Firma suchen (z. B. Straße, PLZ Ort, Reiterhof)',
  id,
  ariaLabel,
  className = '',
  value: controlledValue,
  onValueChange,
  persistQueryOnSelect = false,
  bbox,
  allowedCountryCodes,
  photonLayers,
  onInputKeyDown,
  dismissSuggestionsSignal = 0,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Nach Klick auf einen Vorschlag: `displayValue` ändert sich — ohne das würde der Debounce-Effekt sofort neu fetchen und die Liste wieder öffnen. */
  const suppressFetchAfterSelectRef = useRef(false)
  const listboxId = `${useId().replace(/:/g, '')}-addr-suggestions`

  const isControlled = controlledValue !== undefined
  const displayValue = isControlled ? controlledValue : query

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
        limit: PHOTON_FETCH_LIMIT,
        lang: 'de',
      })
      if (bbox) params.set('bbox', bbox)
      if (photonLayers?.length) {
        for (const layer of photonLayers) {
          params.append('layer', layer)
        }
      }
      const res = await fetch(`${PHOTON_URL}?${params}`)
      const data = await res.json()
      let features: PhotonFeature[] = data?.features ?? []
      if (photonLayers?.length) {
        features = features.filter(photonFeatureIsPlaceLike)
      }
      if (allowedCountryCodes?.length) {
        const allow = new Set(allowedCountryCodes.map((c) => c.toLowerCase()))
        features = features.filter((f) => {
          const c = f.properties?.countrycode?.toLowerCase()
          return c != null && allow.has(c)
        })
      }
      const raw = features.map(featureToAddress).filter((a) => a.street || a.city)
      const seen = new Set<string>()
      const addresses: AddressSuggestion[] = []
      for (const a of raw) {
        const k = suggestionDedupeKey(a)
        if (seen.has(k)) continue
        seen.add(k)
        addresses.push(a)
        if (addresses.length >= MAX_SUGGESTIONS_SHOWN) break
      }
      setSuggestions(addresses)
      setActiveIndex(-1)
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [bbox, allowedCountryCodes, photonLayers])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!displayValue.trim()) {
      setSuggestions([])
      setOpen(false)
      return
    }
    if (suppressFetchAfterSelectRef.current) {
      suppressFetchAfterSelectRef.current = false
      return
    }
    debounceRef.current = setTimeout(() => {
      void (async () => {
        await fetchSuggestions(displayValue)
        if (inputRef.current && document.activeElement === inputRef.current) {
          setOpen(true)
        }
      })()
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [displayValue, fetchSuggestions])

  useEffect(() => {
    if (dismissSuggestionsSignal <= 0) return
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    setOpen(false)
    setSuggestions([])
    setActiveIndex(-1)
    setLoading(false)
    inputRef.current?.blur()
  }, [dismissSuggestionsSignal])

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
    suppressFetchAfterSelectRef.current = true
    let finalAddress = { ...address }
    const hasNumberInStreet = /\d/.test(address.street)
    if (!hasNumberInStreet && displayValue.trim()) {
      const extracted = extractHousenumberFromQuery(displayValue)
      if (extracted) {
        finalAddress = { ...address, street: `${address.street} ${extracted}`.trim() }
      }
    }
    onSelect?.(finalAddress)
    const formatted = formatAddressSuggestionForLocationQuery(finalAddress)
    if (persistQueryOnSelect) {
      if (isControlled) onValueChange?.(formatted)
      else setQuery(formatted)
    } else if (isControlled) {
      onValueChange?.('')
    } else {
      setQuery('')
    }
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
        ref={inputRef}
        id={id}
        type="text"
        value={displayValue}
        onChange={(e) => {
          const v = e.target.value
          if (isControlled) onValueChange?.(v)
          else setQuery(v)
        }}
        onFocus={() => {
          const q = displayValue.trim()
          if (q.length < 3) return
          void (async () => {
            await fetchSuggestions(q)
            if (inputRef.current && document.activeElement === inputRef.current) {
              setOpen(true)
            }
          })()
        }}
        onBlur={() => {
          window.setTimeout(() => {
            if (!wrapperRef.current?.contains(document.activeElement)) {
              setOpen(false)
              setActiveIndex(-1)
            }
          }, 0)
        }}
        onKeyDown={(e) => {
          handleKeyDown(e)
          if (!e.defaultPrevented) onInputKeyDown?.(e)
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        spellCheck={false}
        className={className || 'input w-full'}
        aria-autocomplete="list"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={listboxId}
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#6B7280]">
          Suche…
        </span>
      )}
      {open && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-[13.5rem] w-full overflow-auto rounded-lg border border-[var(--border)] bg-white py-1 shadow-lg"
        >
          {suggestions.map((s, i) => {
            const fromQuery = extractHousenumberFromQuery(displayValue)
            const streetLabel =
              fromQuery && !/\d/.test(s.street) ? `${s.street} ${fromQuery}` : s.street
            const tail = buildCityZipTail(streetLabel, s.zip, s.city)
            const label = [streetLabel, tail, s.country].filter(Boolean).join(', ')
            const flag = s.countryCode ? flagEmojiFromIso3166Alpha2(s.countryCode) : ''
            return (
              <li
                key={`${suggestionDedupeKey(s)}-${i}`}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] ${
                  i === activeIndex
                    ? 'bg-[var(--accent-light)] text-[var(--accent-dark)]'
                    : 'text-[var(--foreground,#1B1F23)] hover:bg-[color-mix(in_oklab,var(--border,#dde9e9)_35%,white)]'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(s)
                }}
              >
                {flag ? (
                  <span className="form-country-flag" aria-hidden>
                    {flag}
                  </span>
                ) : (
                  <span className="form-country-flag-spacer shrink-0" aria-hidden />
                )}
                <span className="min-w-0 flex-1">{label || '—'}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
