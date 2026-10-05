/** Google Places (Maps JS, legacy Places library) loaded once, used through our own dropdown. */

export type PlaceValue = {
  address: string
  street: string | null
  city: string | null
  region: string | null
  postcode: string | null
  country: string | null
  country_code: string | null
  place_id: string | null
  lat: number | null
  lng: number | null
  name: string | null
  /** Suburb (sublocality), when Google returns one. */
  suburb?: string | null
}

export type Prediction = { place_id: string; main: string; secondary: string; description: string }

type Comp = { long_name: string; short_name?: string; types: string[] }
type Details = {
  name?: string
  formatted_address?: string
  address_components?: Comp[]
  geometry?: { location?: { lat: () => number; lng: () => number } }
  types?: string[]
}
type RawPrediction = { place_id: string; description: string; structured_formatting?: { main_text?: string; secondary_text?: string } }
type PlacesLib = {
  AutocompleteService: new () => { getPlacePredictions: (req: object, cb: (r: RawPrediction[] | null, status: string) => void) => void }
  PlacesService: new (el: HTMLElement) => { getDetails: (req: object, cb: (r: Details | null, status: string) => void) => void }
  AutocompleteSessionToken: new () => object
}

const lib = (): PlacesLib | null =>
  ((window as unknown as { google?: { maps?: { places?: PlacesLib } } }).google?.maps?.places) ?? null

let loading: Promise<boolean> | null = null

export function loadPlaces(): Promise<boolean> {
  if (lib()) return Promise.resolve(true)
  if (loading) return loading
  loading = new Promise((resolve) => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
    if (!key) { resolve(false); return }
    // Another screen may already be loading the same script.
    const existing = document.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com/maps/api/js"]')
    if (existing) {
      const t = window.setInterval(() => { if (lib()) { window.clearInterval(t); resolve(true) } }, 150)
      window.setTimeout(() => { window.clearInterval(t); resolve(!!lib()) }, 8000)
      return
    }
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`
    s.async = true
    s.onload = () => resolve(!!lib())
    s.onerror = () => resolve(false)
    document.head.appendChild(s)
  })
  return loading
}

let token: object | null = null
const session = () => { const l = lib(); if (l && !token) token = new l.AutocompleteSessionToken(); return token }

export function predict(input: string, country?: string): Promise<Prediction[]> {
  const l = lib()
  if (!l || input.trim().length < 3) return Promise.resolve([])
  return new Promise((resolve) => {
    new l.AutocompleteService().getPlacePredictions({ input, sessionToken: session(), ...(country ? { componentRestrictions: { country } } : {}) }, (r, status) => {
      if (status !== 'OK' || !r) { resolve([]); return }
      resolve(r.slice(0, 6).map((p) => ({
        place_id: p.place_id, description: p.description,
        main: p.structured_formatting?.main_text ?? p.description, secondary: p.structured_formatting?.secondary_text ?? '',
      })))
    })
  })
}

function part(c: Comp[], type: string, short = false): string | null {
  const x = c.find((k) => k.types.includes(type))
  return x ? (short ? x.short_name ?? x.long_name : x.long_name) : null
}

export function details(placeId: string): Promise<PlaceValue | null> {
  const l = lib()
  if (!l) return Promise.resolve(null)
  return new Promise((resolve) => {
    new l.PlacesService(document.createElement('div')).getDetails(
      { placeId, fields: ['name', 'formatted_address', 'address_components', 'geometry', 'types'], sessionToken: session() },
      (d, status) => {
        token = null // a session ends when a place is picked
        if (status !== 'OK' || !d) { resolve(null); return }
        const c = d.address_components ?? []
        const street = [part(c, 'subpremise'), [part(c, 'street_number'), part(c, 'route')].filter(Boolean).join(' ')].filter(Boolean).join('/') || null
        const isBusiness = (d.types ?? []).some((t) => t === 'establishment' || t === 'point_of_interest')
        resolve({
          address: d.formatted_address ?? '', street,
          city: part(c, 'locality') ?? part(c, 'postal_town') ?? part(c, 'sublocality') ?? null,
          region: part(c, 'administrative_area_level_1'), postcode: part(c, 'postal_code'),
          country: part(c, 'country'), country_code: part(c, 'country', true),
          place_id: placeId, lat: d.geometry?.location?.lat() ?? null, lng: d.geometry?.location?.lng() ?? null,
          name: isBusiness ? d.name ?? null : null,
          suburb: part(c, 'sublocality_level_1') ?? part(c, 'sublocality') ?? part(c, 'neighborhood'),
        })
      },
    )
  })
}
