// Resolves an airline to a bundled logo at /public/airline-logos/{ICAO}.png.
// Air rate options carry the IATA code (from vendor_account_id) and the vendor name.
// Resolve IATA -> ICAO first, then fall back to a name match.
const IATA_TO_ICAO: Record<string, string> = {
  FJ: 'FJI', NZ: 'ANZ', QF: 'QFA', VA: 'VOZ', SB: 'ACI',
  ON: 'RON', SQ: 'SIA', CX: 'CPA', EK: 'UAE', QR: 'QTR',
}
const NAME_TO_ICAO: Record<string, string> = {
  'fiji airways': 'FJI', 'air new zealand': 'ANZ', 'qantas': 'QFA',
  'virgin australia': 'VOZ', 'aircalin': 'ACI', 'nauru airlines': 'RON',
  'singapore airlines': 'SIA', 'cathay pacific': 'CPA',
  'emirates': 'UAE', 'qatar airways': 'QTR',
}
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}
export function resolveAirlineIcao(code?: string | null, name?: string | null): string | null {
  const c = (code ?? '').trim().toUpperCase()
  if (c && IATA_TO_ICAO[c]) return IATA_TO_ICAO[c]
  const n = norm(name ?? '')
  if (n && NAME_TO_ICAO[n]) return NAME_TO_ICAO[n]
  if (n) for (const [key, icao] of Object.entries(NAME_TO_ICAO)) if (n.includes(key)) return icao
  return null
}
export function airlineLogoUrl(code?: string | null, name?: string | null): string | null {
  const icao = resolveAirlineIcao(code, name)
  return icao ? `/airline-logos/${icao}.png` : null
}
