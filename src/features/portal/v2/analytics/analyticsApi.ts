import { supabase } from '../../../../supabase'
import type { PortMap } from '../../../../hooks/usePorts'
import { fmtNum, placeName, titleCase } from '../homeModel'

export const SEA = '#2563EB'
export const AIR = '#D97706'

export type AMonth = { month: string; sea: number; air: number; kg: number; cbm: number; spend: number; co2_kg: number; on_time: number; arrived: number }
export type ALane = { origin: string; destination: string; mode: string; n: number; kg: number; spend: number; cost_per_kg: number | null; transit_days: number | null; sched_days: number | null; on_time_pct: number | null; co2_kg: number }
export type AParty = { party: string; role?: 'supplier' | 'customer'; n: number; kg: number; spend: number; transit_days: number | null; on_time_pct: number | null; avg_delay: number | null; last: string; origins: string[] }
export type ADelay = { job_unique: number; origin: string; destination: string; eta: string; arrived: string; delay: number; party: string | null; vessel: string | null }
export type ATotals = { shipments: number; spend: number; kg: number; cbm: number; co2_kg: number; sea: number; air: number; sea_spend: number; air_spend: number; air_kg: number; lcl: number; fcl: number; lcl_cbm: number; lcl_spend: number; exports: number; imports: number; transit: number | null; arrived_n: number; on_time: number; avg_late_days: number | null }
export type APrior = { shipments: number; spend: number; kg: number; air_kg: number; air_spend: number; lcl_cbm: number; lcl_spend: number; arrived_n: number; on_time: number; transit: number | null }

export type AnalyticsV2 = {
  months_n: number
  totals: ATotals
  prior: APrior
  months: AMonth[]
  lanes: ALane[]
  parties: AParty[]
  delays: ADelay[]
  containers: { n: number; teu: number }
  containers_prior?: { n: number; teu: number }
}

export async function fetchAnalytics(months: number): Promise<AnalyticsV2> {
  const { data, error } = await supabase.rpc('portal_analytics_v2', { p_months: months })
  if (error) throw new Error('Analytics could not load. Refresh to try again.')
  return data as AnalyticsV2
}

/** % change, or null when the base is too small to mean anything. */
export function delta(now: number, before: number): number | null {
  if (!before || before < 1) return null
  return Math.round(((now - before) / before) * 100)
}

/** Small unit costs (per kg, per unit) need cents. */
export const money2 = (n: number) => n.toLocaleString('en-NZ', { style: 'currency', currency: 'NZD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const perKg = (spend: number, kg: number) => (kg > 0 ? spend / kg : null)

/** % change between two unit rates, or null. */
export const rateDelta = (now: number | null, before: number | null) => (now != null && before ? Math.round(((now - before) / before) * 100) : null)

export function monthShort(m: string): string {
  return new Date(`${m}-01T00:00:00`).toLocaleDateString('en-NZ', { month: 'short' })
}
export function monthLong(m: string): string {
  return new Date(`${m}-01T00:00:00`).toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' })
}

export type Insight = { eyebrow: string; stat: string; title: string; body: string }

const pct = (n: number, of: number) => Math.round((n / Math.max(1, of)) * 100)

/** Plain-language highlights about lanes, freight mix and trading partners. Never cost. */
export function insights(a: AnalyticsV2, ports: PortMap): Insight[] {
  const out: Insight[] = []
  const t = a.totals
  if (t.shipments < 3) return out

  const lane = a.lanes[0]
  if (lane) {
    out.push({
      eyebrow: 'Top trade lane',
      stat: `${pct(lane.n, t.shipments)}%`,
      title: `${placeName(lane.origin, ports)} to ${placeName(lane.destination, ports)}`,
      body: `${lane.n} of ${t.shipments} shipments${lane.sched_days ? `, about ${Math.round(lane.sched_days)} days port to port` : ''}.`,
    })
  }

  const mix = [
    { k: 'Air freight', n: t.air ?? 0 },
    { k: 'Sea LCL', n: t.lcl ?? 0 },
    { k: 'Sea FCL', n: t.fcl ?? 0 },
  ].sort((x, y) => y.n - x.n)
  if (mix[0].n > 0) {
    out.push({
      eyebrow: 'Freight mix',
      stat: `${pct(mix[0].n, t.shipments)}%`,
      title: `Mostly ${mix[0].k.toLowerCase()}`,
      body: `${t.air ?? 0} air · ${t.lcl ?? 0} LCL · ${t.fcl ?? 0} FCL shipments.`,
    })
  }

  for (const role of ['supplier', 'customer'] as const) {
    const top = a.parties.find((p) => (p.role ?? 'supplier') === role)
    if (!top) continue
    const from = (top.origins ?? []).filter(Boolean).slice(0, 1).map((o) => placeName(o, ports))[0]
    out.push({
      eyebrow: role === 'supplier' ? 'Top supplier' : 'Top customer',
      stat: String(top.n),
      title: titleCase(top.party),
      body: `${top.n} shipments, ${fmtNum(top.kg, true)} kg${from ? `, ${role === 'supplier' ? 'from' : 'via'} ${from}` : ''}.`,
    })
  }

  if (a.lanes.length >= 3) {
    const top3 = a.lanes.slice(0, 3).reduce((s, l) => s + l.n, 0)
    out.push({ eyebrow: 'Trade lanes', stat: String(a.lanes.length), title: 'Active routes this period', body: `Your top 3 lanes carry ${pct(top3, t.shipments)}% of shipments.` })
  }

  const busiest = [...a.months].sort((x, y) => (y.sea + y.air) - (x.sea + x.air))[0]
  if (busiest && busiest.sea + busiest.air >= 3) {
    out.push({ eyebrow: 'Peak month', stat: monthShort(busiest.month), title: monthLong(busiest.month), body: `${busiest.sea + busiest.air} shipments booked. Book early next year to lock in space.` })
  }
  return out.slice(0, 4)
}
