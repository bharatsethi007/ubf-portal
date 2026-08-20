import { differenceInMonths } from 'date-fns'
import type { AgentBrief } from './agentBriefApi'

export function money(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    maximumFractionDigits: 0,
  }).format(n)
}

export function buildTalkingPoints(brief: AgentBrief): string[] {
  const points: string[] = []
  if (brief.unpaid_count > 0) {
    points.push(
      `⚠ ${brief.unpaid_count} unpaid invoice(s) totalling ${money(brief.unpaid_balance)} — worth raising.`,
    )
  }
  if (brief.last_shipment) {
    const months = differenceInMonths(new Date(), new Date(brief.last_shipment))
    if (months >= 6) {
      points.push('No shipments in over 6 months — reactivation opportunity.')
    }
  }
  if (brief.shipments_total > 100) {
    points.push(`High-volume partner (${brief.shipments_total} shipments to date).`)
  }
  if (brief.recent_lanes.length) {
    const lane = brief.recent_lanes[0]
    points.push(
      `Top lane: ${lane.origin ?? '—'}→${lane.destination ?? '—'} (${lane.mode ?? '—'}, ${lane.shipments}).`,
    )
  }
  return points
}
