import { fmtDate } from '@/utils/format'
import { fmtRelative } from '@/utils/relativeTime'
import type { BookingHistoryRow } from '../bookingRecordTypes'
import { describeHistoryEntry, groupHistoryByDay, historyActorName } from './bookingHistoryFormat'

type Props = { rows: BookingHistoryRow[] }

export default function HistoryFeed({ rows }: Props) {
  if (rows.length === 0) {
    return <p className="muted pad-inline">No history entries for this filter.</p>
  }

  const groups = groupHistoryByDay(rows)

  return (
    <div className="booking-history-feed">
      {groups.map((group) => (
        <section key={group.key} className="booking-history-day-group">
          <h3 className="booking-history-day">{group.label}</h3>
          <ul className="booking-history-list">
            {group.rows.map((row) => (
              <li key={row.id} className="booking-history-entry">
                <div className="booking-history-entry__head">
                  <span className="booking-history-entry__actor">{historyActorName(row)}</span>
                  <time
                    className="booking-history-entry__time muted"
                    dateTime={row.created_at}
                    title={fmtDate(row.created_at, true)}
                  >
                    {fmtRelative(row.created_at)}
                  </time>
                </div>
                <p className="booking-history-entry__text">{describeHistoryEntry(row)}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
