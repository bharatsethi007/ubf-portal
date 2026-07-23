import {
  formatReleaseTimestamp,
  releaseLayer,
  portClearanceLayer,
} from '@/features/clearance/clearanceLayers'
import type {
  BookingTrackingEvent,
  ContainerTrackingRow,
} from '../tracking/trackingTypes'

type Props = {
  containers?: ContainerTrackingRow[] | null
  events?: BookingTrackingEvent[] | null
}

type Row = {
  label: string
  layer: ReturnType<typeof releaseLayer>
}

function PortStatusRow({ label, layer }: Row) {
  const cancelled = layer.cancelled
  const value = layer.released
    ? formatReleaseTimestamp(layer.at)
    : cancelled
      ? 'Cancelled'
      : '—'

  return (
    <li className={`booking-milestones__row${cancelled ? ' booking-milestones__row--warn' : ''}`}>
      <span>{label}</span>
      <span className="booking-port-status__value">
        <span className="tabular-nums">{value}</span>
        <span
          className="booking-container-source-dot booking-container-source-dot--portconnect"
          title="From PortConnect"
          aria-label="From PortConnect"
        />
      </span>
    </li>
  )
}

export default function PortStatusMilestones({
  containers = [],
  events = [],
}: Props) {
  const rows: Row[] = [
    { label: 'MPI released', layer: releaseLayer(containers, 'mpi_release_at', events) },
    { label: 'Customs released', layer: releaseLayer(containers, 'customs_release_at', events) },
    { label: 'Line released', layer: releaseLayer(containers, 'line_release_at', events) },
  ]

  const port = portClearanceLayer(containers, events)

  return (
    <div className="booking-milestones__group">
      <h5 className="booking-milestones__subheading">Port status (automatic)</h5>
      <ul className="booking-milestones__list">
        {rows.map((row) => (
          <PortStatusRow key={row.label} {...row} />
        ))}
      </ul>
      {port.released ? (
        <p className="booking-milestones__hint muted">
          Port clearance complete — MPI and Customs both released.
        </p>
      ) : null}
    </div>
  )
}
