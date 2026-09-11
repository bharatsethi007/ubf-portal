// Airline logo resolution.
// Primary: IATA-keyed CDN (covers any carrier, no per-airline bundling).
// Fallback: bundled /airline-logos/{ICAO}.png for the core Pacific carriers (offline-safe).
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
function resolveAirlineIcao(code?: string | null, name?: string | null): string | null {
  const c = (code ?? '').trim().toUpperCase()
  if (c && IATA_TO_ICAO[c]) return IATA_TO_ICAO[c]
  const n = norm(name ?? '')
  if (n && NAME_TO_ICAO[n]) return NAME_TO_ICAO[n]
  if (n) for (const [key, icao] of Object.entries(NAME_TO_ICAO)) if (n.includes(key)) return icao
  return null
}
// Ordered list of URLs to try. AirlineLogo advances on each onError.
export function airlineLogoSources(code?: string | null, name?: string | null): string[] {
  const out: string[] = []
  const iata = (code ?? '').trim().toUpperCase()
  if (/^[A-Z0-9]{2}$/.test(iata)) {
    out.push(`https://content.airhex.com/content/logos/airlines_${iata}_50_50_s.png`)
  }
  const icao = resolveAirlineIcao(code, name)
  if (icao) out.push(`/airline-logos/${icao}.png`)
  return out
}
