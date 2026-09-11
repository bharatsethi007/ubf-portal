import { useEffect, useRef, useState } from 'react'
import './addressAutocomplete.css'
import './customerPicker.css'

export type AddressComponents = {
  city?: string
  state?: string
  postcode?: string
  country?: string
  countryCode?: string
  street?: string
}

type Props = {
  label: string
  value: string
  onChange: (address: string, components?: AddressComponents) => void
  required?: boolean
  /** When false, plain text input only (no Google Places). */
  usePlaces?: boolean
  /** ISO 3166-1 alpha-2 — restricts Google Places results to this country. */
  countryCode?: string
}

type PlaceComponent = { long_name: string; short_name?: string; types: string[] }
type LatLngLike = { lat: () => number; lng: () => number }
type PlaceResult = {
  formatted_address?: string
  address_components?: PlaceComponent[]
  geometry?: { location?: LatLngLike }
}
type GeocodeResult = { formatted_address?: string; address_components?: PlaceComponent[] }

let loadPromise: Promise<boolean> | null = null

function loadGooglePlaces(): Promise<boolean> {
  if (typeof window !== 'undefined' && window.google?.maps?.places) return Promise.resolve(true)
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve) => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
    if (!key) {
      resolve(false)
      return
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`
    script.async = true
    script.onload = () => resolve(!!window.google?.maps?.places)
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })
  return loadPromise
}

function postcodeFromComponents(components: PlaceComponent[] | undefined): string | undefined {
  for (const c of components ?? []) {
    if (c.types.includes('postal_code')) return c.long_name
  }
  return undefined
}

function streetFromComponents(components: PlaceComponent[] | undefined): string | undefined {
  let streetNumber: string | undefined
  let route: string | undefined
  for (const c of components ?? []) {
    if (c.types.includes('street_number')) streetNumber = c.long_name
    if (c.types.includes('route')) route = c.long_name
  }
  const street = [streetNumber, route].filter(Boolean).join(' ').trim()
  return street || undefined
}

function parsePlace(place: PlaceResult): { address: string } & AddressComponents {
  let city: string | undefined
  let state: string | undefined
  let country: string | undefined
  let countryCode: string | undefined
  for (const c of place.address_components ?? []) {
    if (!city && (c.types.includes('locality') || c.types.includes('postal_town'))) city = c.long_name
    if (!state && c.types.includes('administrative_area_level_1')) state = c.short_name ?? c.long_name
    if (c.types.includes('country')) {
      country = c.long_name
      countryCode = (c.short_name ?? c.long_name)?.toUpperCase()
    }
  }
  const postcode = postcodeFromComponents(place.address_components)
  const street = streetFromComponents(place.address_components)
  return { address: place.formatted_address ?? '', city, state, postcode, country, countryCode, street }
}

async function reverseGeocodePostcode(location: LatLngLike): Promise<string | undefined> {
  const Geocoder = window.google?.maps?.Geocoder
  if (!Geocoder) return undefined
  try {
    const geocoder = new Geocoder()
    const { results } = await geocoder.geocode({ location })
    for (const result of results ?? []) {
      const postcode = postcodeFromComponents(result.address_components)
      if (postcode) return postcode
    }
  } catch {
    /* fall through — resolver uses suburb/alias without postcode */
  }
  return undefined
}

async function geocodeAddress(address: string, countryCode?: string): Promise<({ address: string } & AddressComponents) | undefined> {
  const Geocoder = window.google?.maps?.Geocoder
  if (!Geocoder || !address.trim()) return undefined
  try {
    const geocoder = new Geocoder()
    const { results } = await geocoder.geocode({
      address,
      ...(countryCode ? { componentRestrictions: { country: countryCode.toLowerCase() } } : {}),
    })
    const r = results?.[0]
    if (!r) return undefined
    return parsePlace({ formatted_address: r.formatted_address ?? address, address_components: r.address_components })
  } catch {
    return undefined
  }
}

declare global {
  interface Window {
    google?: {
      maps: {
        places: { Autocomplete: new (el: HTMLInputElement, opts?: object) => GoogleAutocomplete }
        Geocoder: new () => {
          geocode: (req: { location?: LatLngLike; address?: string; componentRestrictions?: { country?: string } }) => Promise<{ results: GeocodeResult[] }>
        }
        event: { clearInstanceListeners: (inst: GoogleAutocomplete) => void }
      }
    }
  }
}

type GoogleAutocomplete = {
  getPlace: () => PlaceResult
  addListener: (event: string, fn: () => void) => unknown
}

export default function AddressAutocomplete({ label, value, onChange, required, usePlaces = true, countryCode }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const onChangeRef = useRef(onChange)
  const [text, setText] = useState(value)
  const [placesReady, setPlacesReady] = useState(false)
  const selectedRef = useRef('')

  onChangeRef.current = onChange

  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = value
    }
    setText(value)
  }, [value])

  useEffect(() => {
    if (placesReady && inputRef.current) inputRef.current.value = value
  }, [placesReady, value])

  useEffect(() => {
    if (!usePlaces) return
    let cancelled = false
    loadGooglePlaces().then((ok) => {
      if (!cancelled) setPlacesReady(ok)
    })
    return () => {
      cancelled = true
    }
  }, [usePlaces])

  useEffect(() => {
    if (!usePlaces || !placesReady) return
    const el = inputRef.current
    if (!el || !window.google?.maps?.places) return

    const ac = new window.google.maps.places.Autocomplete(el, {
      fields: ['formatted_address', 'address_components', 'geometry'],
      ...(countryCode ? { componentRestrictions: { country: countryCode.toLowerCase() } } : {}),
    })

    const listener = ac.addListener('place_changed', () => {
      void (async () => {
        const place = ac.getPlace()
        const parsed = parsePlace(place)
        const { address, city, state, country, countryCode: cc, street } = parsed
        let { postcode } = parsed
        if (!postcode && place.geometry?.location) {
          postcode = await reverseGeocodePostcode(place.geometry.location)
        }
        if (inputRef.current) inputRef.current.value = address
        setText(address)
        selectedRef.current = address
        onChangeRef.current(address, { city, state, postcode, country, countryCode: cc, street })
      })()
    })

    return () => {
      if (listener) window.google?.maps.event.clearInstanceListeners(ac)
    }
  }, [placesReady, usePlaces, countryCode])

  const placesActive = usePlaces && placesReady

  return (
    <div className="address-autocomplete">
      {label && (
        <label className="address-autocomplete__label">
          {label}
          {required && <span className="customer-picker__req"> *</span>}
        </label>
      )}
      <input
        ref={inputRef}
        className="bf-input"
        required={required}
        placeholder={placesActive ? 'Start typing an address…' : 'Enter address'}
        {...(placesActive
          ? {
              defaultValue: value,
              onBlur: (e) => {
                const v = e.currentTarget.value
                if (!v.trim() || v === selectedRef.current) { onChangeRef.current(v); return }
                void (async () => {
                  const g = await geocodeAddress(v, countryCode)
                  if (g) onChangeRef.current(v, { city: g.city, state: g.state, postcode: g.postcode, country: g.country, countryCode: g.countryCode, street: g.street })
                  else onChangeRef.current(v)
                })()
              },
            }
          : {
              value: text,
              onChange: (e) => {
                setText(e.target.value)
                onChange(e.target.value)
              },
            })}
      />
    </div>
  )
}
