import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import ContainerHazardChip from '@/features/bookingRecord/containers/ContainerHazardChip'
import {
  boardContainerConflictTooltip,
  countUnresolvedContainerConflicts,
} from '@/features/bookingRecord/containers/containerConflictUtils'
import { containerTypeLabel, containerTypePillClass } from '../containerTypeUtils'
import type { ImportSeaContainer } from '../types'

type Props = {
  containers: ImportSeaContainer[] | null
}

function TypePill({
  type,
  isoType,
  isoDesc,
}: {
  type: string | null
  isoType?: string | null
  isoDesc?: string | null
}) {
  const label = containerTypeLabel(isoType ?? type, isoDesc)
  if (!label) return null
  return <span className={containerTypePillClass(label)}>{label}</span>
}

export default function ContainerCell({ containers }: Props) {
  const list = (containers ?? []).filter((c) => c.container_no?.trim())
  if (!list.length) return <span className="muted">—</span>

  const first = list[0]
  const firstNo = first.container_no!.trim()
  const extra = list.length - 1
  const conflictTip = boardContainerConflictTooltip(list)
  const hasConflict = countUnresolvedContainerConflicts(list) > 0
  const totalHazards = list.reduce((n, c) => n + (c.hazard_count ?? 0), 0)
  const firstHazards = list.flatMap((c) => {
    const count = c.hazard_count ?? 0
    if (count <= 0) return []
    return [{ hazards: c.hazards, hazardCount: count }]
  })

  return (
    <span className="import-sea-container-cell" onClick={(e) => e.stopPropagation()}>
      {totalHazards > 0 ? (
        <ContainerHazardChip
          hazards={firstHazards[0]?.hazards}
          hazardCount={totalHazards}
          className="import-sea-container-cell__hazard"
        />
      ) : null}
      {hasConflict && conflictTip ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="import-sea-container-cell__warn" aria-label={conflictTip}>
                <AlertTriangle size={14} />
              </span>
            }
          />
          <TooltipContent>{conflictTip}</TooltipContent>
        </Tooltip>
      ) : null}
      <span className="mono import-sea-container-cell__no">{firstNo}</span>
      <TypePill
        type={first.container_type}
        isoType={first.iso_type}
        isoDesc={first.iso_desc}
      />
      {extra > 0 ? (
        <Popover>
          <PopoverTrigger
            render={
              <Badge
                variant="secondary"
                className="import-sea-container-count"
              />
            }
          >
            +{extra}
          </PopoverTrigger>
          <PopoverContent className="import-sea-container-popover" align="start">
            <ul className="import-sea-container-popover__list">
              {list.map((c, i) => (
                <li key={`${c.container_no}-${i}`} className="import-sea-container-popover__row">
                  <span className="mono">{c.container_no}</span>
                  <TypePill
                    type={c.container_type}
                    isoType={c.iso_type}
                    isoDesc={c.iso_desc}
                  />
                  {(c.hazard_count ?? 0) > 0 ? (
                    <ContainerHazardChip hazards={c.hazards} hazardCount={c.hazard_count} />
                  ) : null}
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      ) : null}
    </span>
  )
}
