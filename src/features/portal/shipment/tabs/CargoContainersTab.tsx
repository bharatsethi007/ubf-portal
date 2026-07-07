import { formatShortDate } from '../../dashboard/portalFormat'
import SectionTitle from '../../components/SectionTitle'
import type { Container } from '../../../../types/container'
import type { PortalShipmentDetail } from '../portalShipmentDetailTypes'
import { formatLoadLine } from '../portalShipmentDisplay'

type Props = { shipment: PortalShipmentDetail; containers: Container[] }

export default function CargoContainersTab({ shipment, containers }: Props) {
  return (
    <div className="portal-detail-stack">
      <section className="portal-detail-section">
        <SectionTitle title="Cargo" />
        <dl className="portal-detail-grid">
          <CargoField label="Goods" value={shipment.goods_desc} />
          <CargoField label="Quantity" value={shipment.pack_qty != null ? String(Math.round(Number(shipment.pack_qty))) : null} />
          <CargoField label="Pack type" value={shipment.pack_type} />
          <CargoField label="Weight" value={shipment.weight_kg != null ? `${Math.round(Number(shipment.weight_kg))} kg` : null} />
          <CargoField label="CBM" value={shipment.volume_m3 != null ? String(shipment.volume_m3) : null} />
          <CargoField label="Marks" value={shipment.marks} />
        </dl>
        <p className="portal-detail-muted" style={{ marginTop: 12 }}>
          Load summary: {formatLoadLine(shipment)}
        </p>
      </section>

      <section className="portal-detail-section">
        <SectionTitle title="Containers" />
        {shipment.mode !== 'sea' ? (
          <p className="portal-empty">Air shipment — no containers.</p>
        ) : containers.length === 0 ? (
          <p className="portal-empty">No containers synced for this consol.</p>
        ) : (
          <>
            <p className="portal-detail-muted" style={{ marginBottom: 12 }}>
              Container numbers are at consol level and may appear on shared or LCL consols.
            </p>
            <div className="portal-table-wrap">
              <table className="portal-table">
                <thead>
                  <tr>
                    {['Number', 'Size', 'Seal', 'Avail from', 'Avail to'].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {containers.map((c) => (
                    <tr key={c.c_number}>
                      <td className="nums">{c.c_number}</td>
                      <td className="nums">{c.container_size ?? '—'}</td>
                      <td>{c.seal ?? '—'}</td>
                      <td className="nums">{formatShortDate(c.avail_from)}</td>
                      <td className="nums">{formatShortDate(c.avail_to)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function CargoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="portal-detail-field">
      <dt>{label}</dt>
      <dd>{value?.trim() || '—'}</dd>
    </div>
  )
}
