// Fails if any source file has a BOM or double-encoded UTF-8 (e.g. "Â·", "â€”").
// Cause: Windows PowerShell Get-Content/Set-Content rewrites UTF-8 as ANSI.
// Run: npm run check:encoding
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOTS = ['src', 'supabase/functions']
const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.json', '.md'])
const BAD = /(?:[ÂÃ][\u0080-¿‘-›€™]|â€|â–|â†)/

const problems = []
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { walk(p); continue }
    if (!EXT.has(extname(p))) continue
    const text = readFileSync(p, 'utf8')
    if (text.charCodeAt(0) === 0xfeff) problems.push(`${p}: BOM at start of file`)
    text.split('\n').forEach((line, i) => {
      if (BAD.test(line)) problems.push(`${p}:${i + 1}: ${line.trim().slice(0, 100)}`)
    })
  }
}
for (const r of ROOTS) { try { walk(r) } catch { /* root missing */ } }

if (problems.length) {
  console.error(`Encoding check failed (${problems.length}):\n` + problems.join('\n'))
  process.exit(1)
}
console.log('Encoding check passed.')
