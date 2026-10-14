import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'

export type Pattern = 'fixed' | 'mostly' | 'varies' | 'percent'

export type ChargeStat = {
  key: string
  charge_code: string | null
  label: string
  currency: string
  unit_class: string
  n_quotes: number
  n_lines: number
  n_manual: number
  med: number
  mn: number
  mx: number
  mode_val: number
  mode_share: number
  last_used: string
  is_percent: boolean
  pattern: Pattern
  rule_id: string | null
  rule_status: 'suggested' | 'active' | null
}

const num = (v: unknown) => (v == null ? 0 : Number(v))

function mapStat(r: Record<string, unknown>): ChargeStat {
  return {
    key: String(r.key), charge_code: (r.charge_code as string | null) ?? null, label: String(r.label ?? ''),
    currency: String(r.currency ?? 'NZD'), unit_class: String(r.unit_class ?? 'flat'), n_quotes: num(r.n_quotes), n_lines: num(r.n_lines), n_manual: num(r.n_manual),
    med: num(r.med), mn: num(r.mn), mx: num(r.mx), mode_val: num(r.mode_val), mode_share: num(r.mode_share),
    last_used: String(r.last_used ?? ''), is_percent: r.is_percent === true, pattern: r.pattern as Pattern,
    rule_id: (r.rule_id as string | null) ?? null, rule_status: (r.rule_status as ChargeStat['rule_status']) ?? null,
  }
}

/** Same normaliser as SQL brainbox_norm(): trim, collapse spaces, lower case. */
export function normDesc(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function statKey(code: string | null | undefined, description: string): string {
  return code?.trim() ? code.trim() : `d:${normDesc(description)}`
}

/** Same buckets as SQL brainbox_unit_class(): per kg compares with per kg, flat with flat. */
export function unitClass(unit: string | null | undefined): string {
  const u = (unit ?? '').trim().toLowerCase()
  if (!u) return 'flat'
  if (u.includes('kg')) return 'per_kg'
  if (/w\/?m/.test(u)) return 'per_wm'
  if (u.includes('cbm')) return 'per_cbm'
  if (u.includes('teu')) return 'per_teu'
  if (/cont|20|40/.test(u)) return 'per_container'
  if (u.includes('%')) return 'percent'
  return 'flat'
}

export const statMapKey = (key: string, currency: string, uc: string) => `${key}|${currency}|${uc}`

export async function fetchChargeStats(days = 180, mode: string | null = null): Promise<ChargeStat[]> {
  const { data, error } = await supabase.rpc('brainbox_charge_stats', { p_days: days, p_mode: mode })
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map(mapStat)
}

// One shared copy for every grid on screen; refreshed every 5 minutes.
let cache: { at: number; map: Map<string, ChargeStat> } | null = null
let inflight: Promise<Map<string, ChargeStat>> | null = null

async function loadStatMap(): Promise<Map<string, ChargeStat>> {
  if (cache && Date.now() - cache.at < 300_000) return cache.map
  inflight ??= fetchChargeStats().then((rows) => {
    const map = new Map(rows.map((s) => [statMapKey(s.key, s.currency, s.unit_class), s]))
    cache = { at: Date.now(), map }
    inflight = null
    return map
  }).catch((e) => { inflight = null; throw e })
  return inflight
}

/** Team stats keyed by statMapKey(key, currency, unit class). Empty map until loaded or on error. */
export function useChargeStats(): Map<string, ChargeStat> {
  const [map, setMap] = useState<Map<string, ChargeStat>>(cache?.map ?? new Map())
  useEffect(() => {
    let live = true
    loadStatMap().then((m) => { if (live) setMap(m) }).catch(() => {})
    return () => { live = false }
  }, [])
  return map
}

export type InsightPrompt =
  | { kind: 'make_rule'; key: string; charge_code: string; label: string; value: number; currency: string; unit_class: string; n: number }
  | { kind: 'local_sheet'; n_manual: number; lane_quotes: number; lane_manual: number; path: string }

export type ResponseInsight = {
  currency: string
  sources: { source: string; sell: number; lines: number }[]
  card: { lines: number; total_lines: number; title: string | null; vendor: string | null; valid_to: string | null }
  edited: { count: number; delta: number; base: number; lines: { description: string; suggested: number; final: number; unit: string | null }[] }
  manual: { count: number; legacy: number; in_range: number; no_history: number;
    outliers: { description: string; sell: number; med: number; currency: string; n: number }[] }
  prompts: InsightPrompt[]
}

export async function fetchResponseInsight(responseId: string): Promise<ResponseInsight | null> {
  const { data, error } = await supabase.rpc('brainbox_response_insight', { p_response: responseId })
  if (error) throw error
  return (data as ResponseInsight | null) ?? null
}

export type Kpis = {
  sources: Record<string, number>
  card_lines: number
  card_edited: number
  card_edit_avg_pct: number | null
  manual_charges: number
  uncoded: number
  tracking_since: string | null
}

export async function fetchKpis(days: number, mode: string | null): Promise<Kpis> {
  const { data, error } = await supabase.rpc('brainbox_kpis', { p_days: days, p_mode: mode })
  if (error) throw error
  return data as Kpis
}

/** Creates (or returns) a suggested rule from a charge's history. Approvers turn it on. */
export async function suggestRule(key: string, currency: string, uc = 'flat'): Promise<string> {
  const { data, error } = await supabase.rpc('brainbox_suggest_rule', { p_key: key, p_currency: currency, p_unit_class: uc })
  if (error) throw new Error(error.message)
  cache = null
  return String(data)
}

export type BrainboxRule = {
  id: string; kind: string; prose: string; status: string; origin: string
  action: { charge_code?: string; label?: string; currency?: string; amount?: number | null }
  evidence: { n_quotes?: number; median?: number; min?: number; max?: number; mode_share?: number } | null
  created_at: string; decided_at: string | null; decision_note: string | null
}

export async function fetchRules(statuses: string[]): Promise<BrainboxRule[]> {
  const { data, error } = await supabase.from('brainbox_rules')
    .select('id, kind, prose, status, origin, action, evidence, created_at, decided_at, decision_note')
    .in('status', statuses).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as BrainboxRule[]
}

export async function decideRule(id: string, decision: 'active' | 'rejected' | 'retired', note?: string): Promise<void> {
  const { error } = await supabase.rpc('brainbox_rule_decide', { p_id: id, p_decision: decision, p_note: note ?? null })
  if (error) throw new Error(error.message)
  cache = null
}
