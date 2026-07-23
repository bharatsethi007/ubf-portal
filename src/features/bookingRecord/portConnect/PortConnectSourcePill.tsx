import { RefreshCw } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { portConnectProvenanceTooltip } from './portConnectProvenance'

type Props = {
  lastSync: string | null | undefined
  onClick?: () => void
}

export default function PortConnectSourcePill({ lastSync, onClick }: Props) {
  const tooltip = portConnectProvenanceTooltip(lastSync)
  const pill = (
    <span
      className={`portconnect-source-pill${onClick ? ' portconnect-source-pill--clickable' : ''}`}
      {...(onClick ? { role: 'button', tabIndex: 0 } : {})}
      onClick={onClick}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      } : undefined}
    >
      <RefreshCw size={10} aria-hidden />
      PortConnect
    </span>
  )

  return (
    <Tooltip>
      <TooltipTrigger render={pill} />
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}
