import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { portConnectProvenanceTooltip } from '@/features/bookingRecord/portConnect/portConnectProvenance'

type Props = {
  lastSync?: string | null
}

export default function BoardPortConnectDot({ lastSync }: Props) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className="booking-container-source-dot booking-container-source-dot--portconnect import-sea-pc-dot"
            aria-label="From PortConnect"
          />
        }
      />
      <TooltipContent>{portConnectProvenanceTooltip(lastSync)}</TooltipContent>
    </Tooltip>
  )
}
