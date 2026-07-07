import type { PortMap } from '../../../hooks/usePorts'
import { formatShortDate } from '../../dashboard/portalFormat'
import { resolvePortCountryCode, resolvePortLabel } from '../../dashboard/portalPortDisplay'
import { shipmentDirection } from '../../dashboard/portalStatus'
import { counterpartyName } from '../../dashboard/portalShipmentParty'
import { arrivalDate, departureDate } from '../../dashboard/portalShipmentDates'
import SectionTitle from '../../components/SectionTitle'
import PortalShipmentRouteMap from '../../components/FlatWorldMap/PortalShipmentRouteMap'
import TrackingTimeline from '../TrackingTimeline'
import {
  displayJobNo,
  formatLoadLine,
  freightTypeLabel,
  referenceLabel,
} from '../portalShipmentDisplay'
import { recentTimelineUpdates, transitDays } from '../portalShipmentTimeline'
import type { PortalShipmentBundle } from '../portalShipmentDetailTypes'

type Props = { data: PortalShipmentBundle; ports: PortMap }

function PortPair({ code, mode, ports }: { code: string | null; mode: string | null; ports: PortMap }) {
  const cc = resolvePortCountryCode(code, mode, ports)
  return (
    <span className="portal-detail-port">
      <span className={`fi fi-${cc}`} aria-hidden />
      {resolvePortLabel(code, mode, ports)}
    </span>
  )
}

function GridField({ label, value }: { label: string; value: string }) {
  return (
    <div className="portal-detail-field">
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  )
}

export default function SummaryTab({ data, ports }: Props) {
  const { shipment, containers, timeline } = data
  const dir = shipmentDirection(shipment)
  const partyLabel = dir === 'import' ? 'Shipper' : 'Consignee'
  const containerNums = containers.map((c) => c.c_number).filter(Boolean).join(', ')

  return (
    <div className="portal-detail-summary">
      <div className="portal-detail-summary__col">
        <section className="portal-detail-section">
          <SectionTitle title="Shipment overview" />
          <div className="portal-detail-route">
            <PortPair code={shipment.origin} mode={shipment.mode} ports={ports} />
            <span className="portal-detail-route__arrow">→</span>
            <PortPair code={shipment.destination} mode={shipment.mode} ports={ports} />
          </div>
          <p className="portal-detail-muted nums">
            Transit time: {transitDays(shipment)}
          </p>
        </section>

        <section className="portal-detail-section">
          <SectionTitle title="Route plan" />
          <ol className="portal-detail-chain">
            <li><PortPair code={shipment.origin} mode={shipment.mode} ports={ports} /></li>
            <li><PortPair code={shipment.destination} mode={shipment.mode} ports={ports} /></li>
          </ol>
          <dl className="portal-detail-grid portal-detail-grid--route-dates">
            <GridField label="ETD" value={formatShortDate(departureDate(shipment))} />
            <GridField label="ETA" value={formatShortDate(arrivalDate(shipment))} />
          </dl>
        </section>

        <section className="portal-detail-section">
          <SectionTitle title="Booking details" />
          <dl className="portal-detail-grid">
            <GridField label="Job no." value={displayJobNo(shipment)} />
            <GridField label="Mode" value={shipment.mode === 'air' ? 'Air' : shipment.mode === 'sea' ? 'Sea' : '—'} />
            <GridField label="Type" value={dir === 'export' ? 'Export' : 'Import'} />
            <GridField label="Freight type" value={freightTypeLabel(shipment)} />
            <GridField label="House bill" value={shipment.house_bill ?? '—'} />
            <GridField label="Master bill" value={shipment.master_bill ?? '—'} />
            <GridField label="Load" value={formatLoadLine(shipment)} />
            <GridField label="Reference" value={referenceLabel(shipment)} />
          </dl>
        </section>

        <section className="portal-detail-section">
          <SectionTitle title="Carrier" />
          <dl className="portal-detail-grid">
            <GridField label="Vessel / flight" value={shipment.vessel_flight ?? '—'} />
            {shipment.mode === 'sea' && (
              <GridField label="Container(s)" value={containerNums || '—'} />
            )}
          </dl>
        </section>

        <section className="portal-detail-section">
          <SectionTitle title="Party" />
          <p className="portal-detail-party">
            <span className="portal-detail-muted">{partyLabel}</span>
            {' — '}
            {counterpartyName(shipment) ?? '—'}
          </p>
        </section>
      </div>

      <aside className="portal-detail-summary__aside">
        <div className="portal-card portal-card--route-map">
          <div className="portal-card-title">Route</div>
          <PortalShipmentRouteMap shipment={shipment} ports={ports} />
        </div>
        <section className="portal-detail-section">
          <SectionTitle title="Recent updates" />
          <TrackingTimeline milestones={recentTimelineUpdates(timeline)} compact />
        </section>
      </aside>
    </div>
  )
}
