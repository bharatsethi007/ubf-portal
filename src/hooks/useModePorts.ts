import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export type PortMode = 'air' | 'sea'
export type ModePort = { code: string; name: string; country_code: string | null }

const cache: Record<PortMode, ModePort[] | null> = { air: null, sea: null }
const pending: Record<PortMode, Promise<ModePort[]> | null> = { air: null, sea: null }

async function loadPorts(mode: PortMode): Promise<ModePort[]> {
  const { data, error } = await supabase
    .from('ports')
    .select('code,name,country_code')
    .eq('kind', mode)
    .order('name', { ascending: true })
  if (error || !data) return []
  return data.map((r) => ({
    code: String(r.code),
    name: String(r.name ?? r.code),
    country_code: r.country_code ? String(r.country_code).toLowerCase() : null,
  }))
}

/** Loads sea or air ports (cached per kind) for the check-in port picker. */
export function useModePorts(mode: PortMode) {
  const [ports, setPorts] = useState<ModePort[]>(cache[mode] ?? [])
  const [loading, setLoading] = useState(!cache[mode])

  useEffect(() => {
    let cancelled = false
    if (cache[mode]) {
      setPorts(cache[mode] as ModePort[])
      setLoading(false)
      return
    }
    setLoading(true)
    if (!pending[mode]) pending[mode] = loadPorts(mode)
    ;(pending[mode] as Promise<ModePort[]>).then((list) => {
      cache[mode] = list
      if (!cancelled) {
        setPorts(list)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [mode])

  return { ports, loading }
}

/** Client-side search over code + name; empty query returns nothing (recents shown instead). */
export function filterModePorts(ports: ModePort[], query: string, limit = 20): ModePort[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const out: ModePort[] = []
  for (const p of ports) {
    if (p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) {
      out.push(p)
      if (out.length >= limit) break
    }
  }
  return out
}

const recentKey = (mode: PortMode) => `ubf_checkin_recent_${mode}`

export function getRecentPorts(mode: PortMode): string[] {
  try {
    const raw = localStorage.getItem(recentKey(mode))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function pushRecentPort(mode: PortMode, code: string) {
  const clean = code.trim()
  if (!clean) return
  try {
    const next = [clean, ...getRecentPorts(mode).filter((c) => c.toLowerCase() !== clean.toLowerCase())]
    localStorage.setItem(recentKey(mode), JSON.stringify(next.slice(0, 8)))
  } catch {
    /* ignore quota / disabled storage */
  }
}
