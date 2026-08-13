// UBF office rules — which overseas office quotes local charges at a given port.
//
// This is deliberately a small hard-coded seed. It is a "rule/logic" of the kind
// that should live in a shared, editable store (see the Rules doc + a future
// `offices` table) so it's data-driven and shared across users rather than in code.
// Promote this to a table when we build the rules store.
export const HOME_COUNTRY = 'NZ'

const OFFICES: Record<string, string> = {
  NZ: 'UBF New Zealand',
  FJ: 'UBF Fiji',
  TO: 'UBF Tonga',
  WS: 'UBF Samoa',
}

// UN/LOCODE sea ports are country-prefixed (FJSUV → FJ).
export function countryOfPort(portCode: string | null | undefined): string {
  return (portCode || '').slice(0, 2).toUpperCase()
}

// The overseas UBF office that can quote local charges at this port, or null
// (null for the home country or a country with no UBF office).
export function overseasOfficeForPort(portCode: string | null | undefined): string | null {
  const cc = countryOfPort(portCode)
  if (!cc || cc === HOME_COUNTRY) return null
  return OFFICES[cc] ?? null
}
