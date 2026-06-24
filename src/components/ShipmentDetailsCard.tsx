import type { Shipment } from '../types/shipment'
import { fmtDate, shipmentLabel } from '../utils/format'
import { countryLabel } from '../utils/ports'

function portLine(code: string | null): string {
  if (!code) return '—'
  return `${code} (${countryLabel(code)})`
}

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

export default function ShipmentDetailsCard({ shipment }: { shipment: Shipment }) {
  return (
    <section className="card detail-card">
      <h2>Shipment Details</h2>
      <dl className="detail-facts detail-facts--stacked">
        <div>
          <dt>Shipper</dt>
          <dd className="muted">No data yet</dd>
        </div>
        <div>
          <dt>Client</dt>
          <dd>{shipment.customers?.name ?? '—'}</dd>
        </div>
        <div>
          <dt>Route</dt>
          <dd className="detail-route-row">
            <span className="port-chip">
              <span className="flag">{flagFor(countryLabel(shipment.origin))}</span>
              <span className="mono">{portLine(shipment.origin)}</span>
            </span>
            <span className="route-arrow">→</span>
            <span className="port-chip">
              <span className="flag">{flagFor(countryLabel(shipment.destination))}</span>
              <span className="mono">{portLine(shipment.destination)}</span>
            </span>
          </dd>
        </div>
        <div>
          <dt>Scheduled departure</dt>
          <dd>{fmtDate(shipment.etd, true)}</dd>
        </div>
        <div>
          <dt>Estimated delivery</dt>
          <dd>{fmtDate(shipment.eta, true)}</dd>
        </div>
        <div>
          <dt>Masterbill</dt>
          <dd className="muted">No data yet</dd>
        </div>
        <div>
          <dt>Housebill</dt>
          <dd className="mono">{shipment.house_bill ?? shipmentLabel(shipment)}</dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd>{shipment.mode === 'air' ? 'Air' : 'Sea'}</dd>
        </div>
      </dl>
    </section>
  )
}
