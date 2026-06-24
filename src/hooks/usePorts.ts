import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import type { Port, PortMap } from '../types/port'

let cache: PortMap | null = null
let pending: Promise<PortMap> | null = null

async function loadPorts(): Promise<PortMap> {
  const { data, error } = await supabase.from('ports').select('code,name,lat,lng')
  const map: PortMap = new Map()
  if (error || !data) return map
  for (const row of data) {
    if (row.code == null || row.lat == null || row.lng == null) continue
    map.set(String(row.code), {
      code: String(row.code),
      name: String(row.name ?? row.code),
      lat: Number(row.lat),
      lng: Number(row.lng),
    })
  }
  return map
}

export function usePorts() {
  const [ports, setPorts] = useState<PortMap>(cache ?? new Map())
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    if (cache) {
      setPorts(cache)
      setLoading(false)
      return
    }
    if (!pending) pending = loadPorts()
    pending.then((map) => {
      cache = map
      setPorts(map)
      setLoading(false)
    })
  }, [])

  return { ports, loading }
}

export type { Port, PortMap }
