import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export type SeaPort = {
  code: string
  name: string
  country_code: string | null
}

let cache: SeaPort[] | null = null
let pending: Promise<SeaPort[]> | null = null

async function loadSeaPorts(): Promise<SeaPort[]> {
  const { data, error } = await supabase
    .from('ports')
    .select('code,name,country_code')
    .eq('kind', 'sea')
    .order('name', { ascending: true })
  if (error || !data) return []
  return data.map((r) => ({
    code: String(r.code),
    name: String(r.name ?? r.code),
    country_code: r.country_code ? String(r.country_code).toLowerCase() : null,
  }))
}

export function useSeaPorts() {
  const [ports, setPorts] = useState<SeaPort[]>(cache ?? [])
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    if (cache) { setPorts(cache); setLoading(false); return }
    if (!pending) pending = loadSeaPorts()
    pending.then((list) => { cache = list; setPorts(list); setLoading(false) })
  }, [])

  return { ports, loading }
}

// Simple client-side search over code + name.
export function filterSeaPorts(ports: SeaPort[], query: string, limit = 20): SeaPort[] {
  const q = query.trim().toLowerCase()
  if (!q) return ports.slice(0, limit)
  const out: SeaPort[] = []
  for (const p of ports) {
    if (p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) {
      out.push(p)
      if (out.length >= limit) break
    }
  }
  return out
}
