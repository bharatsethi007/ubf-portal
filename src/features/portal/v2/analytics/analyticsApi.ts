import { supabase } from '../../../../supabase'
import type { PortMap } from '../../../../hooks/usePorts'
import { fmtMoney, fmtNum, placeName, titleCase } from '../homeModel'

export const SEA = '#2563EB'
export const AIR = '#D97706'

export type AMonth = { month: string; sea: number; air: number; kg: number; cbm: number; spend: number; co2_kg: number; on_time: number; arrived: number }
export type ALane = { origin: string; destination: string; mode: string; n: number; kg: number; spend: number; cost_per_kg: number | null; transit_days: number | null; sched_days: number | null; on_time_pct: number | null; co2_kg: number }
export type AParty = { party: string; n: number; kg: number; spend: number; transit_days: number | null; on_time_pct: number | null; avg_delay: number | null; last: string; origins: string[] }
export type ADelay = { job_unique: number; origin: string; destination: string; eta: string; arrived: string; delay: number; party: string | null; vessel: string | null }
export type ATotals = { shipments: number; spend: number; kg: number; cbm: number; co2_kg: number; sea: number; air: number; sea_spend: number; air_spend: number; transit: number | null; arrived_n: number; on_time: number; avg_late_days: number | null }
export type APrior = { shipments: number; spend: number; kg: number; arrived_n: number; on_time: number; transit: number | null }

export type AnalyticsV2 = {
  months_n: number
  totals: ATotals
  prior: APrior
  months: AMonth[]
  lanes: ALane[]
  parties: AParty[]
  delays: ADelay[]
  containers: { n: number; teu: number }
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

export function monthShort(m: string): string {
  return new Date(`${m}-01T00:00:00`).toLocaleDateString('en-NZ', { month: 'short' })
}
export function monthLong(m: string): string {
  return new Date(`${m}-01T00:00:00`).toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' })
}

export type Insight = { tone: 'good' | 'watch' | 'info'; title: string; body: string }

/** Plain-language takeaways from the numbers, most useful first. */
export function insights(a: AnalyticsV2, ports: PortMap): Insight[] {
  const out: Insight[] = []
  const t = a.totals, p = a.prior
  const cNow = perKg(t.spend, t.kg), cPrev = perKg(p.spend, p.kg)
  if (cNow && cPrev) {
    const d = Math.round(((cNow - cPrev) / cPrev) * 100)
    if (Math.abs(d) >= 3) {
      out.push({
        tone: d < 0 ? 'good' : 'watch',
        title: `Freight cost per kg ${d < 0 ? 'down' : 'up'} ${Math.abs(d)}%`,
        body: `${money2(cNow)} per kg now vs ${money2(cPrev)} in the previous ${a.months_n} months, on ${fmtNum(t.kg, true)} kg shipped.`,
      })
    }
  }
  const lane = a.lanes[0]
  if (lane && t.shipments >= 5) {
    const share = Math.round((lane.n / t.shipments) * 100)
    out.push({
      tone: 'info',
      title: `${share}% of shipments on one lane`,
      body: `${placeName(lane.origin, ports)} to ${placeName(lane.destination, ports)} carried ${lane.n} shipments${lane.sched_days ? `, about ${Math.round(lane.sched_days)} days port to port` : ''}.`,
    })
  }
  const cheap = a.lanes.filter((l) => l.cost_per_kg && l.n >= 3).sort((x, y) => (x.cost_per_kg! - y.cost_per_kg!))
  if (cheap.length >= 2) {
    const lo = cheap[0], hi = cheap[cheap.length - 1]
    if (hi.cost_per_kg! > lo.cost_per_kg! * 1.3) {
      out.push({
        tone: 'watch',
        title: 'Big cost gap between lanes',
        body: `${placeName(hi.origin, ports)} costs ${money2(hi.cost_per_kg!)}/kg vs ${money2(lo.cost_per_kg!)}/kg from ${placeName(lo.origin, ports)}. Consolidating suppliers there could save money.`,
      })
    }
  }
  const party = a.parties[0]
  if (party && t.shipments >= 5) {
    out.push({
      tone: 'info',
      title: `${titleCase(party.party)} is your busiest supplier`,
      body: `${party.n} shipments, ${fmtNum(party.kg, true)} kg and ${fmtMoney(party.spend, 'NZD', true)} of freight in this period.`,
    })
  }
  const busiest = [...a.months].sort((x, y) => (y.sea + y.air) - (x.sea + x.air))[0]
  if (busiest && busiest.sea + busiest.air >= 3) {
    out.push({ tone: 'info', title: `${monthLong(busiest.month)} was your peak`, body: `${busiest.sea + busiest.air} shipments booked. Book early for the same period next year to lock in space.` })
  }
  if (t.arrived_n >= 5) {
    const pct = Math.round((t.on_time / t.arrived_n) * 100)
    out.push({ tone: pct >= 80 ? 'good' : 'watch', title: `${pct}% arrived on time`, body: `Of ${t.arrived_n} tracked arrivals${t.avg_late_days ? `, late ones ran ${t.avg_late_days} days over` : ''}.` })
  }
  if (t.co2_kg > 0) {
    out.push({ tone: 'info', title: `${fmtNum(t.co2_kg / 1000, true)} t CO₂e estimated`, body: `About ${fmtNum(t.co2_kg / Math.max(1, t.shipments))} kg per shipment. ${t.air ? 'Air is most of the footprint per kg; sea cuts it by roughly 97%.' : 'All by sea, the lowest-emission mode.'}` })
  }
  return out.slice(0, 4)
}
