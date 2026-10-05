import { fmtDay, type ContainerDates } from './customerTasksApi'

const TONE: Record<string, { bg: string; fg: string }> = {
  overdue: { bg: '#FDECEC', fg: '#B42318' },
  today: { bg: '#FDECEC', fg: '#B42318' },
  soon: { bg: '#FEF4E6', fg: '#B54708' },
  ok: { bg: '#ECFDF3', fg: '#067647' },
  collected: { bg: '#F2F4F7', fg: '#475467' },
  returned: { bg: '#F2F4F7', fg: '#475467' },
  unknown: { bg: 'transparent', fg: '#98A2B3' },
}

function DayPill({ date, status, estimate, title }: { date: string | null; status: string; estimate?: boolean; title?: string }) {
  if (!date) return <span style={{ color: '#98A2B3' }}>-</span>
  const t = TONE[status] ?? TONE.unknown
  return (
    <span title={title} style={{ background: t.bg, color: t.fg, borderRadius: 10, padding: '1px 8px', fontSize: 11, whiteSpace: 'nowrap' }}>
      {estimate ? '~' : ''}{fmtDay(date)}
    </span>
  )
}

export default function ContainerDatesTable({ rows }: { rows: ContainerDates[] }) {
  if (rows.length === 0) return <p className="text-muted-foreground" style={{ fontSize: 12 }}>No containers yet.</p>
  return (
    <div className="table-wrap">
      <table className="data-table data-table--compact">
        <thead>
          <tr>
            <th>Container</th>
            <th>Port free</th>
            <th>Port LFD</th>
            <th>Gated out</th>
            <th>Det. free</th>
            <th>Last det. day</th>
            <th>Planned delivery</th>
            <th>Empty ready</th>
            <th>Returned</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.container_no}>
              <td className="mono">{r.container_no}<span className="text-muted-foreground" style={{ marginLeft: 6, fontSize: 11 }}>{r.container_type ?? ''}</span></td>
              <td>{r.port_free_days ?? '-'}</td>
              <td><DayPill date={r.port_last_free_day} status={r.port_status} /></td>
              <td>{r.gated_out_on ? fmtDay(r.gated_out_on) : '-'}</td>
              <td>{r.detention_free_days}</td>
              <td>
                <DayPill
                  date={r.last_detention_day}
                  status={r.detention_status}
                  estimate={r.detention_is_estimate}
                  title={r.detention_is_estimate ? 'Estimate from ETA, firms up at discharge' : 'From discharge'}
                />
              </td>
              <td>{r.planned_delivery_date ? `${fmtDay(r.planned_delivery_date)}${r.delivery_window ? ` ${r.delivery_window}` : ''}` : '-'}</td>
              <td>
                {r.empty_ready_at
                  ? `Now (${fmtDay(r.empty_ready_at)})`
                  : r.planned_return_date
                    ? <span style={{ color: r.return_after_free_time ? '#B42318' : undefined }} title={r.return_after_free_time ? 'After free time' : undefined}>{fmtDay(r.planned_return_date)}</span>
                    : '-'}
              </td>
              <td>{r.empty_returned_on ? fmtDay(r.empty_returned_on) : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
