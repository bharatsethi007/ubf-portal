import {
  EMPTY_IMPORT_SEA_FILTERS,
  type ImportSeaFilterState,
} from './importSeaFilterLogic'

const KEYS = Object.keys(EMPTY_IMPORT_SEA_FILTERS) as (keyof ImportSeaFilterState)[]

export function filtersFromSearchParams(params: URLSearchParams): ImportSeaFilterState {
  const next = { ...EMPTY_IMPORT_SEA_FILTERS }
  for (const key of KEYS) {
    const v = params.get(key)
    if (v != null && v !== '') next[key] = v as ImportSeaFilterState[typeof key]
  }
  return next
}

export function filtersToSearchParams(filters: ImportSeaFilterState): URLSearchParams {
  const params = new URLSearchParams()
  for (const key of KEYS) {
    const v = filters[key]
    if (v) params.set(key, v)
  }
  return params
}

export function importSeaBackHref(params: URLSearchParams): string {
  const next = new URLSearchParams(params)
  next.delete('from')
  const q = next.toString()
  return `/bookings/import-sea${q ? `?${q}` : ''}`
}

export function bookingRecordHref(bookingId: string, boardParams: URLSearchParams): string {
  const next = new URLSearchParams(boardParams)
  next.set('from', 'import-sea')
  return `/bookings/${bookingId}?${next.toString()}`
}
