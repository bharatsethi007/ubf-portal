import { Link2 } from 'lucide-react'
import { fmt } from '../../../components/Customers/profileUi'
import { CompanyFlag } from '../../../features/company/CompanySplit'
import type { FreightNetwork } from '../agentsApi'
import {
  suggestedToExcludeReason,
  type AgentOption,
  type ExcludeReason,
  type ReviewQueueRow,
} from './reviewApi'
import ReviewRowActions from './ReviewRowActions'
import { ImpExpCell, SuggestedClassBadge } from './reviewUi'

type Props = {
  rows: ReviewQueueRow[]
  networks: FreightNetwork[]
  agents: AgentOption[]
  nameDrafts: Record<string, string>
  networkByCode: Record<string, string>
  busyCode: string | null
  onNameDraft: (code: string, value: string) => void
  onNetworkChange: (code: string, value: string) => void
  onAccept: (row: ReviewQueueRow) => void
  onExclude: (row: ReviewQueueRow, reason: ExcludeReason) => void
  onLink: (row: ReviewQueueRow, agent: AgentOption) => void
}

const suggestBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3, padding: '1px 8px', fontSize: 11.5,
  border: '1px solid var(--line, var(--border))', borderRadius: 999, background: 'var(--paper, #fff)',
  color: 'var(--ink-2)', cursor: 'pointer', fontWeight: 400,
}

function effectiveName(row: ReviewQueueRow, nameDrafts: Record<string, string>): string {
  return row.name?.trim() || nameDrafts[row.code]?.trim() || ''
}

export default function ReviewQueueTable({
  rows,
  networks,
  agents,
  nameDrafts,
  networkByCode,
  busyCode,
  onNameDraft,
  onNetworkChange,
  onAccept,
  onExclude,
  onLink,
}: Props) {
  if (rows.length === 0) {
    return (
      <tr>
        <td colSpan={7} className="text-muted-foreground pad-inline">
          No codes match the current filters.
        </td>
      </tr>
    )
  }

  return (
    <>
      {rows.map((row) => {
        const nameOk = Boolean(effectiveName(row, nameDrafts))
        const busy = busyCode === row.code

        return (
          <tr key={row.code} className="agent-review-row">
            <td className="tabular-nums">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {row.company_id ? <CompanyFlag code={row.company_id} size={11} /> : null}
                {row.raw_code ?? row.code}
              </span>
            </td>
            <td>
              {row.name ? (
                <>
                  {row.name}
                  {row.suggested_agent_id && row.suggested_agent_name ? (
                    <div>
                      <button type="button" style={suggestBtn} disabled={busy}
                        title={`Add this code to ${row.suggested_agent_name} (${row.suggest_reason ?? 'suggested'})`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onLink(row, { id: row.suggested_agent_id!, name: row.suggested_agent_name!, code: null, country: null })
                        }}>
                        <Link2 size={12} />
                        Same as {row.suggested_agent_name}
                        <span className="text-muted-foreground"> · {row.suggest_reason}</span>
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <input
                  className="agent-review-name-input"
                  placeholder="Name required"
                  value={nameDrafts[row.code] ?? ''}
                  disabled={busy}
                  onChange={(e) => onNameDraft(row.code, e.target.value)}
                />
              )}
            </td>
            <td>{row.country ?? '—'}</td>
            <td>
              <ImpExpCell imp={row.imp} exp={row.exp} />
            </td>
            <td>{fmt.date(row.last_activity)}</td>
            <td>
              <SuggestedClassBadge value={row.suggested_class} />
            </td>
            <td>
              <ReviewRowActions
                row={row}
                networks={networks}
                agents={agents}
                networkCode={networkByCode[row.code] ?? ''}
                nameOk={nameOk}
                busy={busy}
                highlightExclude={suggestedToExcludeReason(row.suggested_class)}
                onNetworkChange={(value) => onNetworkChange(row.code, value)}
                onAccept={() => onAccept(row)}
                onExclude={(reason) => onExclude(row, reason)}
                onLink={(agent) => onLink(row, agent)}
              />
            </td>
          </tr>
        )
      })}
    </>
  )
}
