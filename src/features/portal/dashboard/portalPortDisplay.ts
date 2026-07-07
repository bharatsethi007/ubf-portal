import type { PortMap } from '../../../hooks/usePorts'
import { findAirport } from '../../../utils/filterAirports'
import { portCountryCode } from './portalFormat'

/** ISO 3166-1 alpha-2 for flag-icons. */
export function resolvePortCountryCode(
  code: string | null | undefined,
  mode: string | null | undefined,
  ports: PortMap,
): string {
  if (!code) return 'un'
  const upper = code.toUpperCase()

  if (mode === 'air' || upper.length === 3) {
    const airport = findAirport(upper)
    if (airport?.country) return airport.country.toLowerCase()
  }

  // UN/LOCODE (sea): country = first two characters (e.g. NZAKL → nz).
  if (upper.length >= 5) return portCountryCode(upper)

  const port = ports.get(upper)
  if (port && upper.length >= 5) return portCountryCode(upper)

  return portCountryCode(upper)
}

export function resolvePortLabel(
  code: string | null | undefined,
  mode: string | null | undefined,
  ports: PortMap,
): string {
  if (!code) return '—'
  const upper = code.toUpperCase()
  const fromPorts = ports.get(upper)?.name
  if (fromPorts) return fromPorts

  if (mode === 'air' || upper.length === 3) {
    const airport = findAirport(upper)
    if (airport) return airport.city || airport.name
  }

  return upper
}
