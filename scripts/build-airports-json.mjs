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

const csv = fs.readFileSync(path.join(root, 'airports.csv'), 'utf8')
const lines = csv.split('\n').slice(1)
const out = lines
  .filter((l) => l.trim())
  .map((l) => {
    const cols = parseCsvLine(l)
    return {
      iata: cols[0]?.trim(),
      name: cols[2]?.trim(),
      city: cols[10]?.trim(),
      country: cols[9]?.trim(),
    }
  })
  .filter((r) => r.iata && r.iata.length === 3)

const dest = path.join(root, 'src', 'data', 'airports.json')
fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.writeFileSync(dest, JSON.stringify(out))
console.log(`wrote ${out.length} airports to ${dest}`)
