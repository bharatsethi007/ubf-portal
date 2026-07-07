import type { PortalShipmentRow } from '../../dashboard/portalDashboardApi'

type Props = { row: PortalShipmentRow }

function cell(value: number | null | undefined, suffix = ''): string {
  if (value == null || Number.isNaN(value)) return ''
  const n = Number(value)
  if (suffix === ' cbm') {
    const rounded = n >= 100 ? Math.round(n) : Math.round(n * 10) / 10
    return `${rounded}${suffix}`
  }
  return `${Math.round(n)}${suffix}`
}

export default function ShipmentNumericCluster({ row }: Props) {
  const pcs = cell(row.pack_qty)
  const wt = cell(row.weight_kg, ' kg')
  const cbm = cell(row.volume_m3, ' cbm')
  const parts = [pcs && `${pcs} pcs`, wt, cbm].filter(Boolean)

  if (!parts.length) {
    return <span className="portal-num-cluster portal-num-cluster--empty">—</span>
  }

  return (
    <div className="portal-num-cluster nums">
      {parts.map((p) => (
        <span key={p} className="portal-num-cluster__item">{p}</span>
      ))}
    </div>
  )
}
