import { hhmm } from './meetingTime'
import type { ReviewMeetingRow } from './scheduleImportApi'

type Props = {
  rows: ReviewMeetingRow[]
  days: string[]
  onChange: (rows: ReviewMeetingRow[]) => void
}

function patchRow(
  rows: ReviewMeetingRow[],
  key: string,
  patch: Partial<ReviewMeetingRow>,
): ReviewMeetingRow[] {
  return rows.map((r) => (r.key === key ? { ...r, ...patch } : r))
}

export default function ScheduleImportReviewTable({ rows, days, onChange }: Props) {
  return (
    <div className="table-wrap sched-review-wrap">
      <table className="sched-review-table">
        <thead>
          <tr>
            <th />
            <th>Date</th>
            <th>Start</th>
            <th>End</th>
            <th>Agent</th>
            <th>Contact</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>
                <input
                  type="checkbox"
                  checked={row.included}
                  onChange={(e) =>
                    onChange(patchRow(rows, row.key, { included: e.target.checked }))
                  }
                />
              </td>
              <td>
                <select
                  className="input input--sm"
                  value={row.meeting_date}
                  onChange={(e) =>
                    onChange(patchRow(rows, row.key, { meeting_date: e.target.value }))
                  }
                >
                  {days.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="time"
                  className="input input--sm"
                  value={hhmm(row.start_time)}
                  onChange={(e) =>
                    onChange(patchRow(rows, row.key, { start_time: e.target.value }))
                  }
                />
              </td>
              <td>
                <input
                  type="time"
                  className="input input--sm"
                  value={hhmm(row.end_time)}
                  onChange={(e) =>
                    onChange(patchRow(rows, row.key, { end_time: e.target.value }))
                  }
                />
              </td>
              <td>
                <div>{row.agent_name_raw || '—'}</div>
                {row.matched_agent_id ? (
                  <span className="sched-linked-chip">linked</span>
                ) : (
                  <span className="sched-unmatched-chip">new/unmatched</span>
                )}
              </td>
              <td>
                <input
                  className="input input--sm"
                  value={row.contact_name ?? ''}
                  placeholder="Contact"
                  onChange={(e) =>
                    onChange(patchRow(rows, row.key, { contact_name: e.target.value || null }))
                  }
                />
              </td>
              <td>
                <span
                  className={`conf-conf-dot conf-conf-dot--${row.confidence}`}
                  title={row.confidence}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
