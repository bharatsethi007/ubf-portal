import { useEffect, useRef, useState } from 'react'
import './addressAutocomplete.css'
import './customerPicker.css'

export type AddressComponents = {
  city?: string
  state?: string
  postcode?: string
  country?: string
}

type Props = {
  label: string
  value: string
  onChange: (address: string, components?: AddressComponents) => void
  required?: boolean
  /** When false, plain text input only (no Google Places). */
  usePlaces?: boolean
}

type PlaceComponent = { long_name: string; short_name?: string; types: string[] }
type PlaceResult = { formatted_address?: string; address_components?: PlaceComponent[] }

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

function parsePlace(place: PlaceResult): { address: string } & AddressComponents {
  let city: string | undefined
  let state: string | undefined
  let postcode: string | undefined
  let country: string | undefined
  for (const c of place.address_components ?? []) {
    if (!city && (c.types.includes('locality') || c.types.includes('postal_town'))) city = c.long_name
    if (!state && c.types.includes('administrative_area_level_1')) state = c.short_name ?? c.long_name
    if (!postcode && c.types.includes('postal_code')) postcode = c.long_name
    if (c.types.includes('country')) country = c.long_name
  }
  return { address: place.formatted_address ?? '', city, state, postcode, country }
}

declare global {
  interface Window {
    google?: {
      maps: {
        places: { Autocomplete: new (el: HTMLInputElement, opts?: object) => GoogleAutocomplete }
        event: { clearInstanceListeners: (inst: GoogleAutocomplete) => void }
      }
    }
  }
}

type GoogleAutocomplete = {
  getPlace: () => PlaceResult
  addListener: (event: string, fn: () => void) => unknown
}

export default function AddressAutocomplete({ label, value, onChange, required, usePlaces = true }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const onChangeRef = useRef(onChange)
  const [text, setText] = useState(value)
  const [placesReady, setPlacesReady] = useState(false)

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
      fields: ['formatted_address', 'address_components'],
    })

    const listener = ac.addListener('place_changed', () => {
      const parsed = parsePlace(ac.getPlace())
      const { address, ...components } = parsed
      if (inputRef.current) inputRef.current.value = address
      setText(address)
      onChangeRef.current(address, components)
    })

    return () => {
      if (listener) window.google?.maps.event.clearInstanceListeners(ac)
    }
  }, [placesReady, usePlaces])

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
              onBlur: (e) => onChangeRef.current(e.currentTarget.value),
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
