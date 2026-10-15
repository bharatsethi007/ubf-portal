import airports from '../data/airports.json'

export type Airport = {
  iata: string
  name: string
  /** City the airport serves (Chicago for ORD), not the suburb it sits in. */
  city: string
  country: string
  /** 0 large, 1 medium, 2 small, 3 unknown. */
  r?: number
  /** Has scheduled service. */
  s?: number
  /** Other search names, pipe separated: metro code (CHI), old names, suburb. */
  alt?: string
}

const ALL = airports as Airport[]

const byIata = new Map<string, Airport>()
for (const a of ALL) {
  if (!byIata.has(a.iata)) byIata.set(a.iata, a)
}

export function findAirport(iata: string): Airport | undefined {
  return byIata.get(iata.toUpperCase())
}

/** Lowercase, no accents, no apostrophes or dots: "O'Hare" -> "ohare", "Nouméa" -> "noumea". */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’`.]/g, '').replace(/\s+/g, ' ').trim()
}

type Indexed = { a: Airport; code: string; city: string; alts: string[]; name: string; country: string; weight: number }

let regionNames: Intl.DisplayNames | null = null
function countryName(cc: string): string {
  try {
    regionNames ??= new Intl.DisplayNames(['en'], { type: 'region' })
    return (cc && regionNames.of(cc.toUpperCase())) || ''
  } catch { return '' }
}

let index: Indexed[] | null = null
function getIndex(): Indexed[] {
  if (!index) {
    index = ALL.map((a) => ({
      a,
      code: a.iata.toLowerCase(),
      city: norm(a.city),
      alts: (a.alt ?? '').split('|').filter(Boolean).map(norm),
      name: norm(a.name),
      country: norm(countryName(a.country)),
      // Busy airports with scheduled service first when the match is equally good.
      weight: (a.r ?? 3) * 2 + (a.s ? 0 : 1),
    }))
  }
  return index
}

const wordStart = (hay: string, q: string) => hay.startsWith(q) || hay.includes(` ${q}`) || hay.includes(`-${q}`) || hay.includes(`/${q}`)

/**
 * Lower is better. Code and city come first: staff type ORD or Chicago, not O'Hare.
 * 0 exact code, 1 exact city or metro code (CHI), 2 city or code starts with,
 * 4 alias starts with, 5 name word or country starts with (Fiji, Samoa), 6 contains anywhere. Null = no match.
 * Code matching is skipped when the query can't be a code (O'h, new y).
 */
function score(x: Indexed, q: string, codeLike: boolean): number | null {
  if (codeLike && x.code === q) return 0
  if (x.city === q || x.alts.includes(q)) return 1
  if (x.city.startsWith(q) || (codeLike && x.code.startsWith(q))) return 2
  if (wordStart(x.city, q) || x.alts.some((t) => wordStart(t, q))) return 4
  if (wordStart(x.name, q) || (q.length >= 3 && x.country.startsWith(q))) return 5
  if (q.length >= 3 && (x.city.includes(q) || x.name.includes(q) || x.alts.some((t) => t.includes(q)))) return 6
  return null
}

/** Ranked airport search by code, served city, alias or name; at most `limit` matches. */
export function filterAirports(query: string, limit = 20): Airport[] {
  const q = norm(query)
  if (!q) return []
  const codeLike = /^[a-z0-9]{1,3}$/i.test(query.trim())
  const hits: { x: Indexed; s: number }[] = []
  for (const x of getIndex()) {
    const s = score(x, q, codeLike)
    if (s != null) hits.push({ x, s })
  }
  hits.sort((a, b) => a.s - b.s || a.x.weight - b.x.weight || a.x.code.localeCompare(b.x.code))
  return hits.slice(0, limit).map((h) => h.x.a)
}

export function formatAirportLabel(a: Airport): string {
  return `${a.iata} – ${a.name}`
}
