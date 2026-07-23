import type { TrackingEvent } from '../jobDetailApi'
import EmptyTab from './EmptyTab'

type Props = { events: TrackingEvent[]; matched: boolean }

export default function TrackingTab({ events, matched }: Props) {
  if (!matched) {
    return <EmptyTab title="No shipment linked" hint="Match this booking to an ERP job to see tracking." />
  }
  if (events.length === 0) {
    return <EmptyTab title="No tracking events" hint="Events will appear once tracking_events is populated." />
  }

  return (
    <ul className="space-y-3 px-1">
      {events.map((ev) => (
        <li key={String(ev.id)} className="border-b border-border/60 pb-3 last:border-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-medium">{ev.event_type ?? 'Event'}</span>
            <span className="nums text-xs text-muted-foreground">{ev.event_at?.slice(0, 16) ?? '—'}</span>
          </div>
          {ev.location ? <p className="mt-0.5 text-xs text-muted-foreground">{ev.location}</p> : null}
          {ev.description ? <p className="mt-1 text-[12.5px]">{ev.description}</p> : null}
        </li>
      ))}
    </ul>
  )
}
