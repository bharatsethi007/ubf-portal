import { AlertTriangle } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import ContainerHazardChip from '@/features/bookingRecord/containers/ContainerHazardChip'
import {
  boardContainerConflictTooltip,
  countUnresolvedContainerConflicts,
} from '@/features/bookingRecord/containers/containerConflictUtils'
import { containerTypeLabel, containerTypePillClass } from '../containerTypeUtils'
import { containerSizeSummary } from '../containerSize'
import BoardPortConnectDot from './BoardPortConnectDot'
import type { ImportSeaContainer } from '../types'

type Props = {
  containers: ImportSeaContainer[] | null
  lastSync?: string | null
}

function TypePill({ c }: { c: ImportSeaContainer }) {
  const label = containerTypeLabel(c.iso_type ?? c.container_type, c.iso_desc)
  if (!label) return <span className="bk-muted">type not set</span>
  return <span className={containerTypePillClass(label)}>{label}</span>
}

/** Board cell: "1×20'" summary. Hover shows every container with type, source, hazards, conflicts. */
export default function ContainerCell({ containers, lastSync }: Props) {
  const list = (containers ?? []).filter((c) => c.container_no?.trim())
  if (!list.length) return <span className="muted">—</span>

  const conflictTip = boardContainerConflictTooltip(list)
  const hasConflict = countUnresolvedContainerConflicts(list) > 0
  const totalHazards = list.reduce((n, c) => n + (c.hazard_count ?? 0), 0)
  const firstHazard = list.find((c) => (c.hazard_count ?? 0) > 0)
  const anyPc = list.some((c) => c.source === 'portconnect')

  return (
    <span className="import-sea-container-cell" onClick={(e) => e.stopPropagation()}>
      <Popover>
        <PopoverTrigger
          openOnHover
          delay={120}
          render={<button type="button" className="bk-cntr" aria-label={`${list.length} containers, show details`} />}
        >
          {containerSizeSummary(list)}
        </PopoverTrigger>
        <PopoverContent className="bk-cntr-pop" align="start">
          <div className="bk-cntr-pop__head">
            {list.length} container{list.length === 1 ? '' : 's'}
            {anyPc ? <span className="bk-muted"> · PortConnect</span> : null}
          </div>
          <ul className="bk-cntr-pop__list">
            {list.map((c, i) => (
              <li key={`${c.container_no}-${i}`}>
                <span className="bk-mono">{c.container_no}</span>
                {c.source === 'portconnect' ? <BoardPortConnectDot lastSync={lastSync} /> : null}
                <TypePill c={c} />
                {c.iso_desc ? <span className="bk-muted">{c.iso_desc}</span> : null}
                {(c.hazard_count ?? 0) > 0 ? (
                  <ContainerHazardChip hazards={c.hazards} hazardCount={c.hazard_count} />
                ) : null}
              </li>
            ))}
          </ul>
          {hasConflict && conflictTip ? <div className="bk-cntr-pop__warn">{conflictTip}</div> : null}
        </PopoverContent>
      </Popover>
      {anyPc ? <BoardPortConnectDot lastSync={lastSync} /> : null}
      {totalHazards > 0 ? (
        <ContainerHazardChip
          hazards={firstHazard?.hazards}
          hazardCount={totalHazards}
          className="import-sea-container-cell__hazard"
        />
      ) : null}
      {hasConflict ? (
        <span className="import-sea-container-cell__warn" title={conflictTip ?? 'Container conflict'}>
          <AlertTriangle size={13} />
        </span>
      ) : null}
    </span>
  )
}
