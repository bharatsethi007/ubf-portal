import { useEffect, useState } from 'react'
import { fetchAllPorts } from './fetchAllPorts'

export type { SeaPort } from '../utils/filterSeaPorts'
import type { SeaPort } from '../utils/filterSeaPorts'

let cache: SeaPort[] | null = null
let pending: Promise<SeaPort[]> | null = null

async function loadSeaPorts(): Promise<SeaPort[]> {
  const data = await fetchAllPorts({ kind: 'sea' })
  return data.map((r) => ({
    code: String(r.code),
    name: String(r.name ?? r.code),
    country_code: r.country_code ? String(r.country_code).toLowerCase() : null,
    lat: r.lat == null ? null : Number(r.lat),
    lng: r.lng == null ? null : Number(r.lng),
    core: !!r.is_core,
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

export { filterSeaPorts } from '../utils/filterSeaPorts'
