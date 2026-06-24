const COUNTRY_MAP: Record<string, string> = {
  AU: 'Australia',
  NZ: 'New Zealand',
  CN: 'China',
  FJ: 'Fiji',
  US: 'United States',
  GB: 'United Kingdom',
  JP: 'Japan',
  KR: 'South Korea',
  SG: 'Singapore',
  HK: 'Hong Kong',
}

const FILTER_ORIGINS = ['Australia', 'New Zealand', 'China', 'Fiji', 'Other Countries'] as const

export type FilterOrigin = (typeof FILTER_ORIGINS)[number]

export function countryFromPort(code: string | null): FilterOrigin {
  if (!code || code.length < 2) return 'Other Countries'
  const prefix = code.slice(0, 2).toUpperCase()
  return (COUNTRY_MAP[prefix] as FilterOrigin | undefined) ?? 'Other Countries'
}

export function countryLabel(code: string | null): string {
  return countryFromPort(code)
}

export function tradelaneLabel(mode: string, direction: string, origin: string | null): string {
  const modeLabel = mode === 'air' ? 'Air' : 'Sea'
  const dirLabel = direction ? direction.charAt(0).toUpperCase() + direction.slice(1) : ''
  const country = countryFromPort(origin)
  if (country !== 'Other Countries') {
    return `${country.toUpperCase()} ${modeLabel} · ${dirLabel}`
  }
  return `${modeLabel} · ${dirLabel}`
}

export { FILTER_ORIGINS }
