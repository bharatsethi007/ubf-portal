import type { PortMap } from '../../../hooks/usePorts'
import { formatShortDate } from '../dashboard/portalFormat'
import type { PortalShipmentRow } from '../dashboard/portalDashboardApi'
import { shipmentTrackingId } from '../dashboard/portalDashboardApi'
import { counterpartyName, customerRefDisplay } from '../dashboard/portalShipmentParty'
import { resolvePortCountryCode } from '../dashboard/portalPortDisplay'
import { shipmentDirection } from '../dashboard/portalStatus'
import { arrivalDate, departureDate } from '../dashboard/portalShipmentDates'
import StatusPill from './ShipmentsTable/StatusPill'

type Props = {
  row: PortalShipmentRow
  ports: PortMap
  containerLabel: string
  onClose: () => void
}

function routeLine(row: PortalShipmentRow, ports: PortMap): string {
  const o = ports.get(row.origin ?? '')?.name ?? row.origin ?? '—'
  const d = ports.get(row.destination ?? '')?.name ?? row.destination ?? '—'
  return `${o} → ${d}`
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="portal-modal-field">
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  )
}

export default function ShipmentDetailModal({ row, ports, containerLabel, onClose }: Props) {
  const dir = shipmentDirection(row)
  const ccO = resolvePortCountryCode(row.origin, row.mode, ports)
  const ccD = resolvePortCountryCode(row.destination, row.mode, ports)
  const cargo = [row.goods_desc, row.pack_type].filter(Boolean).join(' · ') || '—'
  const pcs = row.pack_qty != null ? String(Math.round(Number(row.pack_qty))) : '—'
  const wt = row.weight_kg != null ? `${Math.round(Number(row.weight_kg))} kg` : '—'
  const cbm = row.volume_m3 != null ? `${row.volume_m3} cbm` : '—'
  const partyLabel = dir === 'export' ? 'Consignee' : 'Shipper'
  const ref = customerRefDisplay(row)

  return (
    <div className="portal-modal-backdrop" onClick={onClose} role="presentation">
      <div className="portal-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="portal-modal__head">
          <div>
            <div className="portal-modal__title nums">{shipmentTrackingId(row)}</div>
            <div className="portal-modal__route">
              <span className={`fi fi-${ccO}`} /> {routeLine(row, ports)}
              <span className={`fi fi-${ccD}`} style={{ marginLeft: 6 }} />
            </div>
          </div>
          <button type="button" className="portal-modal__close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <dl className="portal-modal__grid">
          <Field label={partyLabel} value={counterpartyName(row) ?? ''} />
          <Field label="Direction" value={dir === 'export' ? 'Export' : 'Import'} />
          <Field label="ETD" value={formatShortDate(departureDate(row))} />
          <Field label="ETA" value={formatShortDate(arrivalDate(row))} />
          <Field label="Mode" value={row.mode === 'air' ? 'Air' : row.mode === 'sea' ? 'Sea' : (row.mode ?? '—')} />
          <Field label="Vessel / flight" value={row.vessel_flight ?? '—'} />
          {row.mode === 'sea' && <Field label="Container" value={containerLabel || '—'} />}
          <Field label="Cargo" value={cargo} />
          <Field label="Pcs" value={pcs} />
          <Field label="Weight" value={wt} />
          <Field label="CBM" value={cbm} />
          <Field label="Reference" value={ref === '—' ? '' : ref} />
          <div className="portal-modal-field">
            <dt>Status</dt>
            <dd><StatusPill status={row.status} /></dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
