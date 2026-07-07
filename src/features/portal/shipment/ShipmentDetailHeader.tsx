import { Link } from 'react-router-dom'
import { formatShortDate, formatKg } from '../dashboard/portalFormat'
import { shipmentDirection } from '../dashboard/portalStatus'
import StatusPill from '../components/ShipmentsTable/StatusPill'
import { displayJobNo, placedDate, shipmentDetailTitle } from './portalShipmentDisplay'
import type { PortalShipmentDetail } from './portalShipmentDetailTypes'

type Props = { shipment: PortalShipmentDetail }

export default function ShipmentDetailHeader({ shipment }: Props) {
  const dir = shipmentDirection(shipment)
  const title = shipmentDetailTitle(shipment)
  const placed = placedDate(shipment)
  const modeLabel = shipment.mode === 'air' ? 'Air' : shipment.mode === 'sea' ? 'Sea' : (shipment.mode ?? '—')

  return (
    <header className="portal-detail-header">
      <nav className="portal-detail-breadcrumb" aria-label="Breadcrumb">
        <Link to="/portal">Home</Link>
        <span>/</span>
        <Link to="/portal/shipments">Shipments</Link>
        <span>/</span>
        <span>Shipment detail</span>
      </nav>

      <div className="portal-detail-header__main">
        <div>
          <h1 className="portal-detail-header__title">{title}</h1>
          <div className="portal-detail-header__meta nums">
            <span>Job {displayJobNo(shipment)}</span>
            <span className="portal-detail-header__sep">·</span>
            <span>{modeLabel}</span>
            {shipment.weight_kg != null && (
              <>
                <span className="portal-detail-header__sep">·</span>
                <span>{formatKg(Number(shipment.weight_kg))}</span>
              </>
            )}
            <span className="portal-detail-header__sep">·</span>
            <span>{dir === 'export' ? 'Export' : 'Import'}</span>
            {placed && (
              <>
                <span className="portal-detail-header__sep">·</span>
                <span>Placed {formatShortDate(placed)}</span>
              </>
            )}
          </div>
        </div>
        <StatusPill status={shipment.status} />
      </div>
    </header>
  )
}
