import { useEffect, useState } from 'react'
import { supabase } from '../../../supabase'

export type Level = 'info' | 'warn' | 'error'
export type LogRow = { id: string; ts: string; source: string; level: Level; kind: string; fn: string | null; message: string }
export type Bucket = { t: string; info: number; warn: number; error: number }
export type Histogram = { step_seconds: number; buckets: Bucket[]; total: number; sources: { source: string; n: number; err: number }[] }
export type UptimeDay = { d: string; n: number; ok: number }
export type Uptime = Record<string, UptimeDay[]>
export type Provider = { code: string; name: string; category: string; important: boolean }

export type SystemAlert = {
  id: number; key: string; kind: string; severity: 'warn' | 'critical'; title: string; detail: string | null
  opened_at: string; last_seen_at: string; resolved_at: string | null; notified_open_at: string | null
}
export type AlertSettings = { enabled: boolean; emails: string[]; sync_late_hours: number; notify_resolved: boolean; updated_at: string }
export type AlertsData = { settings: AlertSettings; is_admin: boolean; alerts: SystemAlert[] }

export type LogFilter = { from: Date; to: Date; sources: string[]; levels: Level[]; q: string }

const args = (f: LogFilter) => ({
  p_from: f.from.toISOString(), p_to: f.to.toISOString(),
  p_sources: f.sources.length ? f.sources : null,
  p_levels: f.levels.length && f.levels.length < 3 ? f.levels : null,
  p_q: f.q.trim() || null,
})

export async function fetchLogs(f: LogFilter, before?: string, limit = 200): Promise<LogRow[]> {
  const { data, error } = await supabase.rpc('system_logs', { ...args(f), p_limit: limit, p_before: before ?? null })
  if (error) throw new Error(error.message)
  return (data ?? []) as LogRow[]
}

export async function fetchHistogram(f: LogFilter, buckets = 60): Promise<Histogram> {
  const { data, error } = await supabase.rpc('system_log_histogram', { ...args(f), p_buckets: buckets })
  if (error) throw new Error(error.message)
  return data as Histogram
}

export async function fetchLogDetail(id: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.rpc('system_log_detail', { p_id: id })
  if (error) throw new Error(error.message)
  return data as Record<string, unknown> | null
}

export async function saveAlertSettings(s: Pick<AlertSettings, 'enabled' | 'emails' | 'sync_late_hours' | 'notify_resolved'>) {
  const { data, error } = await supabase.rpc('system_alert_settings_save', {
    p_enabled: s.enabled, p_emails: s.emails, p_sync_late_hours: s.sync_late_hours, p_notify_resolved: s.notify_resolved,
  })
  if (error) throw new Error(error.message)
  return data as AlertSettings
}

export async function sendTestAlert() {
  const { data, error } = await supabase.functions.invoke('system-alerts', { body: { action: 'test' } })
  if (error) throw new Error(error.message)
  return data as { ok: boolean; error: string | null; to: string[] }
}

let providerCache: Provider[] | null = null
export function useProviders() {
  const [list, setList] = useState<Provider[]>(providerCache ?? [])
  useEffect(() => {
    if (providerCache) return
    supabase.from('api_providers').select('code, name, category, important').eq('active', true).order('sort_order')
      .then(({ data }) => { providerCache = (data ?? []) as Provider[]; setList(providerCache) })
  }, [])
  return list
}

/* One colour per source family, so the stream scans by eye. */
const CAT_COLOUR: Record<string, string> = {
  AI: '#8B5CF6', Messaging: '#3B82F6', Tracking: '#14B8A6', TMS: '#F97316', Courier: '#EC4899', Storage: '#64748B',
}
const SPECIAL: Record<string, { name: string; colour: string }> = {
  'twf-sync': { name: 'TWF sync', colour: '#22C55E' },
  cron: { name: 'Scheduled jobs', colour: '#A1A1AA' },
  alerts: { name: 'Alerts', colour: '#EF4444' },
}
export function sourceMeta(code: string, providers: Provider[]) {
  if (SPECIAL[code]) return SPECIAL[code]
  const p = providers.find((x) => x.code === code)
  return { name: p?.name ?? code, colour: CAT_COLOUR[p?.category ?? ''] ?? '#A1A1AA' }
}

export const RANGES = [
  { key: '15m', label: '15m', ms: 15 * 60_000 },
  { key: '1h', label: '1h', ms: 3_600_000 },
  { key: '6h', label: '6h', ms: 6 * 3_600_000 },
  { key: '24h', label: '24h', ms: 24 * 3_600_000 },
  { key: '7d', label: '7d', ms: 7 * 86_400_000 },
] as const
export type RangeKey = (typeof RANGES)[number]['key']
