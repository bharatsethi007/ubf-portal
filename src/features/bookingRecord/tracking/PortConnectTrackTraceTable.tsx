import { Flame } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import PortConnectClearedCell from './PortConnectClearedCell'
import {
  formatPortConnectDateTimeShort,
} from './portConnectAucklandDate'
import type { PortConnectVisitView } from './trackingTypes'

type Props = {
  visits: PortConnectVisitView[]
  onSelect: (visit: PortConnectVisitView) => void
  embedded?: boolean
}

const COLS = [
  'Port', 'Container', 'Category', 'Vessel Visit', 'Vessel ETA/ATA', 'Location',
  'Status', 'MT Return', 'ISO', 'Weight (kg)', 'Security Check', 'Cleared',
  'Impediments', 'Temp', 'Hazard', 'Oversize', 'Last Free Time',
] as const

function vesselArrivalCell(visit: PortConnectVisitView): string {
  const { at, kind } = visit.vesselArrival
  if (!at || !kind) return '—'
  return `${kind} ${formatPortConnectDateTimeShort(at)}`
}

export default function PortConnectTrackTraceTable({ visits, onSelect, embedded }: Props) {
  if (!visits.length) {
    return (
      <div className={`pc-track-table__empty${embedded ? ' pc-track-table__empty--embedded' : ' empty card pad-inline'}`}>
        No PortConnect visit data yet — enable tracking and press Refresh.
      </div>
    )
  }

  return (
    <div className={`shipments-table pc-track-table${embedded ? ' pc-track-table--embedded' : ' card'}`}>
      <div className="table-wrap">
        <table className="data-table data-table--compact">
          <thead>
            <tr>
              {COLS.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visits.map((visit) => (
              <tr
                key={visit.row.id}
                className="row-clickable"
                onClick={() => onSelect(visit)}
              >
                <td>{visit.port ?? '—'}</td>
                <td className="mono">{visit.row.container_no}</td>
                <td>{visit.category ?? '—'}</td>
                <td>{visit.vesselVisit ?? '—'}</td>
                <td className="tabular-nums">{vesselArrivalCell(visit)}</td>
                <td>{visit.location ?? '—'}</td>
                <td>{visit.status ?? '—'}</td>
                <td>{visit.mtReturn ?? '—'}</td>
                <td>{visit.isoLabel ?? '—'}</td>
                <td className="tabular-nums">{visit.weightKg ?? '—'}</td>
                <td>{visit.securityCheck ?? '—'}</td>
                <td><PortConnectClearedCell status={visit.cleared} /></td>
                <td>
                  {visit.impedimentCount > 0 ? (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span className="pc-impediment">{visit.impedimentCount}</span>
                        }
                      />
                      <TooltipContent>
                        {visit.impedimentCodes.length
                          ? visit.impedimentCodes.join(', ')
                          : `${visit.impedimentCount} stop(s)`}
                      </TooltipContent>
                    </Tooltip>
                  ) : '—'}
                </td>
                <td>{visit.temp ?? '—'}</td>
                <td>
                  {visit.hazardCount > 0 ? (
                    <span className="pc-hazard-count">
                      <Flame size={12} />
                      {visit.hazardCount}
                    </span>
                  ) : '—'}
                </td>
                <td>{visit.oversizeCount > 0 ? visit.oversizeCount : '—'}</td>
                <td className="tabular-nums">
                  {visit.lastFreeTime
                    ? formatPortConnectDateTimeShort(visit.lastFreeTime)
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
