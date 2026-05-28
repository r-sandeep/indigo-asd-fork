import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { hereSearch } from '@/lib/hereApi'

// ── Types ──────────────────────────────────────────────────────────────────

export interface AddressResult {
  line1:  string
  city:   string
  county: string   // retained — county is useful context for job sites
  state:  string   // 2-letter code
  zip:    string
  lat:    number | null  // null if geocode step fails
  lng:    number | null  // null if geocode step fails
  // country is intentionally omitted — always USA for this app
}

interface HereAddress {
  label?:       string
  houseNumber?: string
  street?:      string
  city?:        string
  county?:      string
  stateCode?:   string
  state?:       string
  postalCode?:  string
}

interface HereItem {
  title:    string
  address:  HereAddress
  position?: { lat: number; lng: number }
}

interface DropdownRect {
  top:   number
  left:  number
  width: number
}

interface Props {
  value:        string
  onChange:     (value: string) => void
  onSelect:     (result: AddressResult) => void
  placeholder?: string
  className?:   string
  disabled?:    boolean
}

// ── HERE helpers ───────────────────────────────────────────────────────────

/** Two-line label shown in the dropdown — mirrors the GGB Sales Tool. */
function itemLabel(item: HereItem): { main: string; sub: string } {
  const a = item.address
  const main =
    a.houseNumber && a.street
      ? `${a.houseNumber} ${a.street}`
      : (item.title || a.label || '')
  const sub = [a.city, a.stateCode ?? a.state, a.postalCode]
    .filter(Boolean)
    .join(', ')
  return { main, sub }
}

/**
 * Converts a selected HERE autocomplete item into a partial AddressResult.
 * lat/lng are null here — they get filled in by a separate geocode call in handleSelect.
 */
function itemToResult(item: HereItem): AddressResult {
  const a = item.address
  return {
    line1:  a.houseNumber && a.street
              ? `${a.houseNumber} ${a.street}`
              : (item.title || a.label || ''),
    city:   a.city   ?? '',
    county: a.county ?? '',
    state:  a.stateCode ?? a.state ?? '',
    zip:    a.postalCode ?? '',
    lat:    item.position?.lat ?? null,
    lng:    item.position?.lng ?? null,
  }
}

// ── Debounce ───────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

// ── Component ──────────────────────────────────────────────────────────────

/**
 * Address autocomplete backed by the HERE Discover API.
 * Returns structured AddressResult (line1, city, county, state, zip, lat, lng).
 * Country is always USA and is intentionally not included in the result.
 *
 * Dropdown renders via React portal at document.body (position:fixed) so it
 * escapes overflow:hidden/auto ancestors such as scrollable modals.
 *
 * Requires VITE_HERE_API_KEY to be set.
 */
export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  className,
  disabled,
}: Props) {
  const inputRef           = useRef<HTMLInputElement>(null)
  const ignoreNextFetchRef = useRef(false)

  const [items,       setItems]       = useState<HereItem[]>([])
  const [open,        setOpen]        = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [apiError,    setApiError]    = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [rect,        setRect]        = useState<DropdownRect>({ top: 0, left: 0, width: 0 })

  const debouncedQuery = useDebounce(value, 280) // match the 280 ms the GGB tool uses

  // ── Measure input for portal positioning ──────────────────────────────────

  const measureInput = useCallback(() => {
    if (!inputRef.current) return
    const r = inputRef.current.getBoundingClientRect()
    setRect({ top: r.bottom + 4, left: r.left, width: r.width })
  }, [])

  useEffect(() => {
    if (!open) return
    measureInput()
    window.addEventListener('scroll', measureInput, true)
    window.addEventListener('resize', measureInput)
    return () => {
      window.removeEventListener('scroll', measureInput, true)
      window.removeEventListener('resize', measureInput)
    }
  }, [open, measureInput])

  // ── Fetch suggestions from HERE Discover ──────────────────────────────────

  useEffect(() => {
    if (ignoreNextFetchRef.current) {
      ignoreNextFetchRef.current = false
      return
    }

    const q = debouncedQuery.trim()
    if (q.length < 3) {
      setItems([])
      setOpen(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setApiError(null)

    hereSearch(q, 'autocomplete')
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.text().catch(() => '')
          throw new Error(`HERE API ${r.status}: ${body.slice(0, 120)}`)
        }
        return r.json() as Promise<{ items?: HereItem[] }>
      })
      .then((data) => {
        if (cancelled) return
        // autocomplete endpoint returns no position — keep all items and geocode on select
        const results = data.items ?? []
        setItems(results)
        setOpen(results.length > 0)
        setActiveIndex(-1)
      })
      .catch((err: Error) => {
        if (!cancelled) {
          console.error('[AddressAutocomplete]', err.message)
          setApiError(err.message)
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [debouncedQuery])

  // ── Close on outside click ────────────────────────────────────────────────

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSelect(item: HereItem) {
    const { main } = itemLabel(item)
    ignoreNextFetchRef.current = true
    onChange(main)
    setItems([])
    setOpen(false)
    setActiveIndex(-1)

    // Build partial result from autocomplete address fields (no lat/lng yet)
    const partial = itemToResult(item)

    // Geocode separately to get lat/lng, then call onSelect with full result
    const fullAddress = [partial.line1, partial.city, partial.state, partial.zip]
      .filter(Boolean).join(', ')
    hereSearch(fullAddress, 'geocode')
      .then(async (r) => {
        if (!r.ok) return null
        const data = await r.json() as { items?: Array<{ position?: { lat: number; lng: number } }> }
        return data.items?.[0]?.position ?? null
      })
      .catch(() => null)
      .then((pos) => {
        onSelect({ ...partial, lat: pos?.lat ?? null, lng: pos?.lng ?? null })
      })
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || items.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      handleSelect(items[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const dropdown =
    open && items.length > 0
      ? createPortal(
          <ul
            role="listbox"
            style={{
              position: 'fixed',
              top:      rect.top,
              left:     rect.left,
              width:    rect.width,
              zIndex:   9999,
            }}
            className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl"
          >
            {items.map((item, i) => {
              const { main, sub } = itemLabel(item)
              return (
                <li
                  key={i}
                  role="option"
                  aria-selected={i === activeIndex}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    handleSelect(item)
                  }}
                  className={`cursor-pointer px-3 py-2.5 transition-colors ${
                    i === activeIndex ? 'bg-brand-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <p className={`text-sm font-medium leading-snug ${
                    i === activeIndex ? 'text-brand-800' : 'text-gray-900'
                  }`}>
                    {main}
                  </p>
                  {sub && (
                    <p className="mt-0.5 text-xs text-gray-400">{sub}</p>
                  )}
                </li>
              )
            })}
          </ul>,
          document.body,
        )
      : null

  return (
    <>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (items.length > 0) { measureInput(); setOpen(true) }
          }}
          placeholder={placeholder ?? 'Start typing to search address…'}
          disabled={disabled}
          className={className}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-haspopup="listbox"
        />
        {loading && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="h-4 w-4 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          </span>
        )}
      </div>

      {apiError && (
        <p className="mt-1 text-xs text-red-600">
          Address lookup failed — {apiError.startsWith('HERE API 401')
            ? 'API key not authorised for this domain. See setup instructions.'
            : apiError}
        </p>
      )}

      {dropdown}
    </>
  )
}
