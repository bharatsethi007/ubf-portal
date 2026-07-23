import { Flame } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  hazardCountFromList,
  hazardTooltipText,
  normalizeHazards,
} from './hazardUtils'

type Props = {
  hazards?: unknown
  hazardCount?: number | null
  className?: string
}

export default function ContainerHazardChip({ hazards, hazardCount, className }: Props) {
  const list = normalizeHazards(hazards)
  const count = hazardCountFromList(list, hazardCount ?? 0)
  if (count <= 0) return null

  const tip = hazardTooltipText(list, count)

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={`container-hazard-chip${className ? ` ${className}` : ''}`}
            aria-label={tip ?? 'Hazardous cargo'}
          >
            <Flame size={12} />
            <span>DG</span>
          </span>
        }
      />
      <TooltipContent className="container-hazard-chip__tip">
        {tip?.split('\n').map((line) => <div key={line}>{line}</div>) ?? 'Hazardous cargo'}
      </TooltipContent>
    </Tooltip>
  )
}
