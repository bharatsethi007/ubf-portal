import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { portConnectRefreshIneligibleReason } from './importSeaBoardUtils'
import type { ImportSeaRow } from './types'

type Props = {
  row: ImportSeaRow
  busy: boolean
  cooldownSec: number
  onRefresh: () => void
}

export default function ImportSeaRowRefreshCell({ row, busy, cooldownSec, onRefresh }: Props) {
  const ineligible = portConnectRefreshIneligibleReason(row)
  const disabled = Boolean(ineligible) || busy || cooldownSec > 0

  const tooltip = ineligible
    ?? (cooldownSec > 0 ? `Wait ${cooldownSec}s before refreshing again` : 'Refresh PortConnect for this booking')

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="import-sea-row-refresh"
            disabled={disabled}
            aria-label="Refresh PortConnect"
            onClick={(e) => {
              e.stopPropagation()
              onRefresh()
            }}
          />
        }
      >
        <RefreshCw size={14} className={busy ? 'import-sea-spin' : undefined} />
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}
