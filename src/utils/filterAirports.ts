import airports from '../data/airports.json'

export type Airport = {
  iata: string
  name: string
  city: string
  country: string
}

const ALL = airports as Airport[]

const byIata = new Map<string, Airport>()
for (const a of ALL) {
  if (!byIata.has(a.iata)) byIata.set(a.iata, a)
}

export function findAirport(iata: string): Airport | undefined {
  return byIata.get(iata.toUpperCase())
}

/** Filter airports by IATA, name, or city; returns at most `limit` matches. */
export function filterAirports(query: string, limit = 20): Airport[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const hits: Airport[] = []
  for (const a of ALL) {
    if (
      a.iata.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.city.toLowerCase().includes(q)
    ) {
      hits.push(a)
      if (hits.length >= limit) break
    }
  }
  return hits
}

export function formatAirportLabel(a: Airport): string {
  return `${a.iata} – ${a.name}`
}
