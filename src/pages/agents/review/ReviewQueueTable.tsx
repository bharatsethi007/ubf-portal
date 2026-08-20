import { fmt } from '../../../components/Customers/profileUi'
import type { FreightNetwork } from '../agentsApi'
import {
  suggestedToExcludeReason,
  type ExcludeReason,
  type ReviewQueueRow,
} from './reviewApi'
import ReviewRowActions from './ReviewRowActions'
import { ImpExpCell, SuggestedClassBadge } from './reviewUi'

type Props = {
  rows: ReviewQueueRow[]
  networks: FreightNetwork[]
  nameDrafts: Record<string, string>
  networkByCode: Record<string, string>
  busyCode: string | null
  onNameDraft: (code: string, value: string) => void
  onNetworkChange: (code: string, value: string) => void
  onAccept: (row: ReviewQueueRow) => void
  onExclude: (row: ReviewQueueRow, reason: ExcludeReason) => void
}

function effectiveName(row: ReviewQueueRow, nameDrafts: Record<string, string>): string {
  return row.name?.trim() || nameDrafts[row.code]?.trim() || ''
}

export default function ReviewQueueTable({
  rows,
  networks,
  nameDrafts,
  networkByCode,
  busyCode,
  onNameDraft,
  onNetworkChange,
  onAccept,
  onExclude,
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
            <td className="tabular-nums">{row.code}</td>
            <td>
              {row.name ? (
                row.name
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
                networkCode={networkByCode[row.code] ?? ''}
                nameOk={nameOk}
                busy={busy}
                highlightExclude={suggestedToExcludeReason(row.suggested_class)}
                onNetworkChange={(value) => onNetworkChange(row.code, value)}
                onAccept={() => onAccept(row)}
                onExclude={(reason) => onExclude(row, reason)}
              />
            </td>
          </tr>
        )
      })}
    </>
  )
}
