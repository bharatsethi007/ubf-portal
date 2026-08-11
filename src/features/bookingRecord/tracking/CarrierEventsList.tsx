import type { BookingTrackingEvent } from './trackingTypes'
import { carrierEventLabel } from './carrierEventLabels'
import { eventVesselLabel, formatEventTimestamp } from './trackingFormat'

type Props = { events: BookingTrackingEvent[] }

export default function CarrierEventsList({ events }: Props) {
  const carrierEvents = events.filter((ev) => ev.source === 'carrier')
  if (carrierEvents.length === 0) return null

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Event</th>
            <th>Location</th>
            <th>Vessel / voyage</th>
          </tr>
        </thead>
        <tbody>
          {carrierEvents.map((ev) => {
            const vessel = eventVesselLabel(ev)
            return (
              <tr key={String(ev.id)}>
                <td className="nums">{formatEventTimestamp(ev.event_datetime)}</td>
                <td>
                  {carrierEventLabel(ev.event_type_code)}
                  {ev.is_estimated ? <span className="muted"> · est.</span> : null}
                </td>
                <td>{ev.event_location ?? ev.partner_port_code ?? '—'}</td>
                <td>{vessel ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
