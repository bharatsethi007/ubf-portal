import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../../../supabase'

/* Bumped by the page refresh button; every health hook reloads when it changes. */
export const HealthTick = createContext(0)

export function useHealthRpc<T>(fn: string, args: Record<string, unknown> = {}, pollMs = 60_000) {
  const tick = useContext(HealthTick)
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const key = JSON.stringify(args)

  useEffect(() => {
    let alive = true
    const load = async () => {
      const { data: d, error: e } = await supabase.rpc(fn, args)
      if (!alive) return
      if (e) setError(e.message)
      else { setData(d as T); setError(null) }
      setLoading(false)
    }
    load()
    const id = pollMs ? window.setInterval(load, pollMs) : 0
    return () => { alive = false; if (id) window.clearInterval(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, key, tick, pollMs])

  return { data, error, loading }
}

export type Overview = {
  apis_total: number; apis_down: number; calls_24h: number; errors_24h: number; bytes_24h: number
  sync_last: string | null; db_bytes: number; s3_bytes: number | null; cron_failed_24h: number
}

export type ApiRow = {
  code: string; name: string; category: string; important: boolean; log_bodies: boolean; cost_note: string | null
  calls: number; errors: number; avg_ms: number | null; p95_ms: number | null; bytes_out: number; bytes_in: number
  last_ok: string | null; last_err: string | null; last_err_msg: string | null; last_err_status: number | null
  probe_ok: boolean | null; probe_status: number | null; probe_ms: number | null; probe_at: string | null; probe_err: string | null
  uptime_7d: number | null; series: number[] | null
}

export type ApiCall = {
  id: number; at: string; provider: string; fn: string | null; method: string | null; host: string | null; path: string | null
  status: number | null; ok: boolean; ms: number | null; bytes_out: number | null; bytes_in: number | null
  error: string | null; req_body: string | null; res_body: string | null
}

export type Backend = {
  db_bytes: number; db_limit_bytes: number; conn_total: number; conn_active: number; conn_idle: number; conn_max: number
  long_queries: number; cache_hit: number | null
  tables: { name: string; bytes: number; rows: number }[]
  cron: { name: string; schedule: string; active: boolean; last_status: string | null; last_start: string | null; last_secs: number | null; last_msg: string | null }[]
  cron_24h: { ok: number; failed: number; transient?: number }
  cron_failures: { name: string; at: string; msg: string | null }[]
  http_24h: { total: number; errors: number }
  http_errors: { at: string; status: number | null; msg: string | null }[]
}

export type Storage = {
  latest_at: string | null
  areas: { area: string; objects: number; bytes: number; at: string }[]
  trend: { day: string; bytes: number; objects: number }[]
  checks: { at: string; ok: boolean; ms: number | null; error: string | null }[]
}

export type SyncRun = {
  id: number; source: string; script: string | null; host: string | null; started_at: string; finished_at: string | null
  status: 'running' | 'ok' | 'error'; modules: Record<string, number> | null; rows_written: number | null
  message: string | null; log: string | null
}

export type Sync = {
  modules: { module: string; last_run: string | null; last_modified: string | null }[]
  tables: { name: string; synced_at: string | null }[]
  runs: SyncRun[]
  jobs: { id: number; status: string; requested_by: string | null; requested_at: string; finished_at: string | null; message: string | null }[]
  fx: { last_applied_at: string | null; last_result: string | null } | null
  portconnect_24h: { ok: number; total: number }
}

export async function runProbe(action: 'probe' | 'storage') {
  const { data, error } = await supabase.functions.invoke('system-probe', { body: { action } })
  if (error) throw new Error(error.message)
  return data as { ok: boolean; up?: number; total?: number; areas?: number; error?: string }
}
