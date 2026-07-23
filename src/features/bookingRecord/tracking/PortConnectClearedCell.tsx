import { Check, AlertTriangle, X } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ClearedStatus } from './trackingTypes'

type Props = { status: ClearedStatus }

export default function PortConnectClearedCell({ status }: Props) {
  if (status === 'cleared') {
    return <Check size={14} className="pc-cleared pc-cleared--ok" aria-label="Cleared" />
  }
  if (status === 'cancelled') {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="pc-cleared pc-cleared--warn" aria-label="Clearance cancelled">
              <AlertTriangle size={14} />
            </span>
          }
        />
        <TooltipContent>A clearance event was cancelled</TooltipContent>
      </Tooltip>
    )
  }
  return <X size={14} className="pc-cleared pc-cleared--no" aria-label="Not cleared" />
}
