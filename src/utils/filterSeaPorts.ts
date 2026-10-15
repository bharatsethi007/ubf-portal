import { countryName, norm, wordStart } from './placeSearch'

export type SeaPort = {
  code: string
  name: string
  country_code: string | null
  lat: number | null
  lng: number | null
  /** Main port (is_core). Ranked first when matches are equally good. */
  core?: boolean
}

// Other names staff type for a port: the city it serves, old names, common short forms.
const SEA_ALIASES: Record<string, string[]> = {
  INNSA: ['Mumbai', 'JNPT', 'Nhava Sheva', 'Jawaharlal Nehru'],
  INBOM: ['Bombay'],
  INMAA: ['Madras'],
  AEJEA: ['Dubai'],
  MYPKG: ['Kuala Lumpur', 'Klang'],
  THLCH: ['Bangkok'],
  VNSGN: ['Saigon', 'HCMC'],
  VNCLI: ['Ho Chi Minh', 'Saigon'],
  CNYTN: ['Shenzhen'],
  CNSHK: ['Shenzhen'],
  CNNSA: ['Guangzhou'],
  CNTSN: ['Xingang'],
  KRPUS: ['Pusan'],
  NZLYT: ['Christchurch'],
  NZPOE: ['Port Chalmers', 'Dunedin'],
  NZBLU: ['Invercargill'],
  NZNPE: ['Hawkes Bay'],
  NZTRG: ['Mount Maunganui', 'Mt Maunganui'],
  FJLTK: ['Nadi'],
  TOTBU: ["Nuku'alofa", 'Tongatapu'],
  WSAPW: ['Samoa'],
  USNYC: ['NYC', 'Newark'],
  USLGB: ['Los Angeles'],
  USLAX: ['Long Beach'],
  GBFXT: ['London'],
  GBLGP: ['London Gateway'],
  IDJKT: ['Tanjung Priok'],
  IDSUB: ['Tanjung Perak'],
}

type SeaIndexed = { p: SeaPort; code: string; loc: string; name: string; alts: string[]; country: string; weight: number }
const indexCache = new WeakMap<SeaPort[], SeaIndexed[]>()

function getSeaIndex(ports: SeaPort[]): SeaIndexed[] {
  let idx = indexCache.get(ports)
  if (!idx) {
    idx = ports.map((p) => ({
      p,
      code: p.code.toLowerCase(),
      // Location part of the UN/LOCODE: NZAKL -> akl. Staff often type just that.
      loc: p.code.length === 5 ? p.code.slice(2).toLowerCase() : '',
      name: norm(p.name),
      alts: (SEA_ALIASES[p.code.toUpperCase()] ?? []).map(norm),
      country: norm(countryName(p.country_code)),
      weight: p.core ? 0 : 1,
    }))
    indexCache.set(ports, idx)
  }
  return idx
}

/**
 * Lower is better. Code and city first, like airports.
 * 0 exact code (NZAKL) or location part (AKL), 1 exact name or alias (Mumbai),
 * 2 name or code starts with, 4 alias or name word starts with,
 * 5 country starts with (Fiji), 6 contains anywhere.
 */
function seaScore(x: SeaIndexed, q: string, codeLike: boolean): number | null {
  if (codeLike && (x.code === q || x.loc === q)) return 0
  if (x.name === q || x.alts.includes(q)) return 1
  if (x.name.startsWith(q) || (codeLike && (x.code.startsWith(q) || (q.length >= 2 && x.loc.startsWith(q))))) return 2
  if (wordStart(x.name, q) || x.alts.some((t) => wordStart(t, q))) return 4
  if (q.length >= 3 && x.country.startsWith(q)) return 5
  if (q.length >= 3 && (x.name.includes(q) || x.alts.some((t) => t.includes(q)))) return 6
  return null
}

/** Ranked sea port search by UN/LOCODE, location code, name, alias or country. */
export function filterSeaPorts(ports: SeaPort[], query: string, limit = 20): SeaPort[] {
  const q = norm(query)
  if (!q) return ports.slice(0, limit)
  const codeLike = /^[a-z0-9]{1,5}$/i.test(query.trim())
  const hits: { x: SeaIndexed; s: number }[] = []
  for (const x of getSeaIndex(ports)) {
    const s = seaScore(x, q, codeLike)
    if (s != null) hits.push({ x, s })
  }
  hits.sort((a, b) => a.s - b.s || a.x.weight - b.x.weight || a.x.name.localeCompare(b.x.name) || a.x.code.localeCompare(b.x.code))
  return hits.slice(0, limit).map((h) => h.x.p)
}
