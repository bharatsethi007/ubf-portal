import airlinesData from '../data/airlines.json'

export type Airline = { code: string; name: string }

const AIRLINES = airlinesData as Airline[]

export function filterAirlines(query: string, limit = 15): Airline[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  return AIRLINES.filter(
    (a) => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q),
  ).slice(0, limit)
}

export function findAirline(code: string): Airline | undefined {
  const c = code.trim().toUpperCase()
  if (!c) return undefined
  return AIRLINES.find((a) => a.code.toUpperCase() === c)
}
