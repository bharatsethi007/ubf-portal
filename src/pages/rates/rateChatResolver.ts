export type ChatPort = { code: string; name: string }
export type ResolvedQuery = {
  from: ChatPort | null
  to: ChatPort | null
  containers: { size: string; qty: number }[]
  assumedContainer: boolean
}

function parseContainers(text: string): { size: string; qty: number }[] {
  const re = /(\d+)?\s*[x×]?\s*(20|40)\s*(?:'|ft|foot|feet|gp|dc|dv|hc|hq|high\s*cube|container|containers|reefer|nor)?\b\s*(hc|hq|high\s*cube)?/gi
  const found: { size: string; qty: number }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index === re.lastIndex) re.lastIndex++
    const hasContext = !!m[1] || /(?:'|ft|foot|feet|gp|dc|dv|hc|hq|cube|container|reefer|nor|[x×])/i.test(m[0])
    if (!hasContext) continue
    const size = m[2] + (m[3] ? 'HC' : '')
    found.push({ size, qty: m[1] ? parseInt(m[1], 10) : 1 })
  }
  const merged = new Map<string, number>()
  for (const c of found) merged.set(c.size, (merged.get(c.size) ?? 0) + c.qty)
  return [...merged.entries()].map(([size, qty]) => ({ size, qty }))
}

export function resolveRateQuery(text: string, ports: ChatPort[], aliases: { alias: string; port_code: string }[]): ResolvedQuery {
  const lower = ' ' + text.toLowerCase() + ' '
  const byCode = new Map(ports.map((p) => [p.code, p]))
  const hits: { code: string; index: number; len: number }[] = []
  const consider = (needle: string, code: string) => {
    if (!needle || needle.length < 3) return
    const idx = lower.indexOf(needle.toLowerCase())
    if (idx >= 0) hits.push({ code, index: idx, len: needle.length })
  }
  for (const p of ports) { consider(p.name, p.code); consider(p.code, p.code) }
  for (const a of aliases) consider(a.alias, a.port_code)
  hits.sort((a, b) => a.index - b.index || b.len - a.len)
  const ordered: string[] = []
  for (const h of hits) if (!ordered.includes(h.code)) ordered.push(h.code)
  const from = ordered[0] ? byCode.get(ordered[0]) ?? null : null
  const to = ordered[1] ? byCode.get(ordered[1]) ?? null : null
  let containers = parseContainers(text)
  const assumedContainer = containers.length === 0
  if (assumedContainer) containers = [{ size: '20', qty: 1 }]
  return { from, to, containers, assumedContainer }
}
