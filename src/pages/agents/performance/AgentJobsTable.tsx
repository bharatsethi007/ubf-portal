import { Link } from 'react-router-dom'
import { fmtMoney } from '../agentStatsApi'
import { NetPills } from './AgentsPerformanceTables'
import { CLASS_LABEL, CLASS_STYLE, fmtDay, type JobClass, type JobRow } from './agentsPerformanceApi'

type Props = {
  rows: JobRow[]; selected: Set<number>; onToggle: (id: number) => void; onToggleAll: (on: boolean) => void
  canEdit: boolean; onSet: (ids: number[], cls: JobClass | 'auto') => void
}

export function ClassPill({ cls, title }: { cls: JobClass; title?: string }) {
  const [bg, fg] = CLASS_STYLE[cls]
  return <span className="inline-flex whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px]" style={{ background: bg, color: fg }} title={title}>{CLASS_LABEL[cls]}</span>
}

const WHY: Record<JobClass, string> = {
  freehand: 'Rule: no freight billed by us (import) or freight billed to the agent (export)',
  nomination: 'Rule: freight billed to the customer',
  exception: 'Rule could not decide: export with no freight line, import freight billed to the agent, or freight billed to both',
  unbilled: 'Nothing invoiced yet',
  excluded: 'Left out of stats',
}

/** Agent jobs with their class. Tick rows for bulk changes; each row can be changed on its own. */
export default function AgentJobsTable({ rows, selected, onToggle, onToggleAll, canEdit, onSet }: Props) {
  const all = rows.length > 0 && rows.every((r) => selected.has(r.job_unique))
  return (
    <table className="data-table" style={{ minWidth: 1320 }}>
      <thead className="sticky top-0 z-[1] bg-white"><tr>
        {canEdit && <th style={{ width: 32 }}><input type="checkbox" aria-label="Select all" checked={all} onChange={(e) => onToggleAll(e.target.checked)} /></th>}
        <th>Job</th><th>Date</th><th>Dir</th><th>Mode</th><th>Agent</th><th>Customer</th><th>Lane</th>
        <th>Freight billed to</th><th style={{ textAlign: 'right' }}>Freight sell</th><th style={{ textAlign: 'right' }}>GP</th><th>Class</th>{canEdit && <th>Change</th>}
      </tr></thead>
      <tbody>
        {rows.length === 0 ? <tr><td colSpan={canEdit ? 13 : 11} className="text-muted-foreground pad-inline">No jobs match.</td></tr> : rows.map((r) => (
          <tr key={r.job_unique} style={{ background: selected.has(r.job_unique) ? '#F5F8FF' : undefined }}>
            {canEdit && <td><input type="checkbox" aria-label="Select job" checked={selected.has(r.job_unique)} onChange={() => onToggle(r.job_unique)} /></td>}
            <td className="whitespace-nowrap"><span className="font-mono text-[12px]">{r.job_no ?? r.job_unique}</span>{r.house_bill && <div className="text-[11px] text-[#5B6474]">{r.house_bill}</div>}</td>
            <td className="whitespace-nowrap">{fmtDay(r.dt)}</td>
            <td className="capitalize">{r.direction === 'import' ? 'Imp' : 'Exp'}</td>
            <td className="whitespace-nowrap">{[r.mode, r.load_type].filter(Boolean).join(' ') || '–'}</td>
            <td className="max-w-[220px]"><Link to={`/agents/${r.agent_id}`} className="block truncate text-[#0F172A]" title={r.agent}>{r.agent}</Link><NetPills codes={r.networks} /></td>
            <td className="max-w-[200px] truncate" title={r.customer ?? ''}>{r.customer ?? r.customer_account_id ?? '–'}</td>
            <td className="whitespace-nowrap font-mono text-[11.5px]">{r.origin ?? '?'} &gt; {r.destination ?? '?'}</td>
            <td className="max-w-[140px] truncate font-mono text-[11.5px]" title={r.frt_bill_to ?? ''}>{r.frt_bill_to ?? (r.charge_lines ? 'No freight line' : 'Not billed')}</td>
            <td style={{ textAlign: 'right' }}>{r.frt_sell ? fmtMoney(r.frt_sell) : '–'}</td>
            <td style={{ textAlign: 'right' }}>{r.gp == null ? '–' : fmtMoney(r.gp)}</td>
            <td className="whitespace-nowrap">
              <ClassPill cls={r.class} title={r.overridden ? `Set by staff${r.override_note ? `: ${r.override_note}` : ''}. Rule says ${CLASS_LABEL[r.auto_class]}.` : WHY[r.auto_class]} />
              {r.overridden && <span className="ml-1 text-[10.5px] text-[#5B6474]">edited</span>}
            </td>
            {canEdit && (
              <td>
                <select className="h-7 rounded-md border border-[#E6E8EE] px-1 text-[12px]" value="" aria-label="Change class"
                  onChange={(e) => { if (e.target.value) onSet([r.job_unique], e.target.value as JobClass | 'auto') }}>
                  <option value="">Set…</option>
                  <option value="freehand">Free hand</option>
                  <option value="nomination">Nomination</option>
                  <option value="excluded">Exclude</option>
                  {r.overridden && <option value="auto">Back to rule</option>}
                </select>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
