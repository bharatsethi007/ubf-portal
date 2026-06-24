import type { Shipment } from '../types/shipment'
import { fmtDate } from '../utils/format'
import { countryLabel } from '../utils/ports'
import { parseVesselFlight } from '../utils/tracking'

function flagFor(country: string): string {
  const flags: Record<string, string> = {
    Australia: '🇦🇺',
    'New Zealand': '🇳🇿',
    China: '🇨🇳',
    Fiji: '🇫🇯',
    'United Kingdom': '🇬🇧',
    'United States': '🇺🇸',
  }
  return flags[country] ?? '🏳️'
}

export default function VoyageDetailsCard({ shipment }: { shipment: Shipment }) {
  const { vessel, voyage } = parseVesselFlight(shipment.vessel_flight)
  const departed = shipment.departed ?? shipment.etd
  const arrival = shipment.arrived ?? shipment.eta

  return (
    <section className="card detail-card">
      <h2>Voyage Details</h2>
      <dl className="detail-facts detail-facts--stacked">
        <div>
          <dt>From</dt>
          <dd>
            <span className="port-chip">
              <span className="flag">{flagFor(countryLabel(shipment.origin))}</span>
              <span>{shipment.origin ?? '—'} ({countryLabel(shipment.origin)})</span>
            </span>
            <span className="detail-sub">
              {departed ? `Actual ${fmtDate(departed)}` : '—'}
            </span>
          </dd>
        </div>
        <div>
          <dt>To</dt>
          <dd>
            <span className="port-chip">
              <span className="flag">{flagFor(countryLabel(shipment.destination))}</span>
              <span>{shipment.destination ?? '—'} ({countryLabel(shipment.destination)})</span>
            </span>
            <span className="detail-sub">
              {arrival ? `Estimated ${fmtDate(arrival)}` : '—'}
            </span>
          </dd>
        </div>
        <div>
          <dt>Vessel</dt>
          <dd>{vessel}</dd>
        </div>
        <div>
          <dt>Voyage</dt>
          <dd className="mono">{voyage}</dd>
        </div>
      </dl>
    </section>
  )
}
