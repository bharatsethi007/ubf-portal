import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function parseCsvLine(line) {
  const cols = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (ch === ',' && !inQuotes) {
      cols.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  cols.push(cur)
  return cols
}

// Served city (Chicago, not Rosemont), search aliases (CHI, Tokyo), size and scheduled flag.
// From OurAirports (public domain) municipality/keywords; edit airport-cities.csv to override.
const extra = new Map()
for (const l of fs.readFileSync(path.join(root, 'airport-cities.csv'), 'utf8').split('\n').slice(1)) {
  if (!l.trim()) continue
  const [iata, city, aliases, size, scheduled] = parseCsvLine(l)
  extra.set(iata.trim(), { city: city.trim(), alt: aliases.trim(), r: Number(size), s: scheduled.trim() === '1' })
}

const csv = fs.readFileSync(path.join(root, 'airports.csv'), 'utf8')
const lines = csv.split('\n').slice(1)
const out = lines
  .filter((l) => l.trim())
  .map((l) => {
    const cols = parseCsvLine(l)
    const iata = cols[0]?.trim()
    const x = extra.get(iata)
    const row = {
      iata,
      name: cols[2]?.trim(),
      city: x?.city || cols[10]?.trim(),
      country: cols[9]?.trim(),
      // r: 0 large, 1 medium, 2 small, 3 unknown. s: scheduled passenger/cargo service.
      r: x ? x.r : 3,
    }
    if (x?.s) row.s = 1
    if (x?.alt) row.alt = x.alt
    return row
  })
  .filter((r) => r.iata && r.iata.length === 3)

const dest = path.join(root, 'src', 'data', 'airports.json')
fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.writeFileSync(dest, JSON.stringify(out))
console.log(`wrote ${out.length} airports to ${dest}`)
