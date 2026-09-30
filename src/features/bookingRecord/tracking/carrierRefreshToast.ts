import type { CarrierRefreshSummary } from './carrierTrackingApi'
import type { SvRefreshSummary } from './seaVantageTrackingApi'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** One-line toast text for a SeaVantage refresh result. */
export function formatSeaVantageSummary(summary: SvRefreshSummary): string {
  if (summary.skipped) return summary.reason ?? 'Skipped'
  const parts: string[] = []
  if (summary.containers_registered) parts.push(`${summary.containers_registered} registered`)
  parts.push(
    plural(summary.containers_found, 'container'),
    plural(summary.events_written, 'event'),
    plural(summary.positions_written, 'AIS point'),
  )
  if (summary.containers_no_data.length) parts.push(`no data: ${summary.containers_no_data.join(', ')}`)
  return parts.join(' · ')
}

/** One-line toast text for a Maersk refresh, including the SeaVantage fallback case. */
export function formatCarrierSummary(summary: CarrierRefreshSummary): string {
  if (summary.fallback === 'seavantage' && summary.seavantage) {
    return `Via SeaVantage (no Maersk data) · ${formatSeaVantageSummary(summary.seavantage)}`
  }
  const parts = [
    summary.matched_carrier
      ? `${summary.matched_carrier}: ${plural(summary.containers_found, 'container')}`
      : `${plural(summary.containers_found, 'container')} matched`,
    plural(summary.events_written, 'new event'),
  ]
  if (summary.containers_not_recognised.length) {
    parts.push(`no Maersk data: ${summary.containers_not_recognised.join(', ')}`)
  }
  return parts.join(' · ')
}
