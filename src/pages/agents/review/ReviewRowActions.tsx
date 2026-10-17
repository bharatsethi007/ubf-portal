import { Ban, ChevronDown, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { FreightNetwork } from '../agentsApi'
import {
  EXCLUDE_REASONS,
  type AgentOption,
  type ExcludeReason,
  type ReviewQueueRow,
} from './reviewApi'
import LinkAgentPicker from './LinkAgentPicker'

const EXCLUDE_LABELS: Record<ExcludeReason, string> = {
  self: 'Self',
  'own office': 'Own office',
  carrier: 'Carrier',
  customer: 'Customer',
  'not agent': 'Not agent',
}

type Props = {
  row: ReviewQueueRow
  networks: FreightNetwork[]
  agents: AgentOption[]
  networkCode: string
  nameOk: boolean
  busy: boolean
  highlightExclude: ExcludeReason | null
  onNetworkChange: (value: string) => void
  onAccept: () => void
  onExclude: (reason: ExcludeReason) => void
  onLink: (agent: AgentOption) => void
}

export default function ReviewRowActions({
  networks,
  agents,
  networkCode,
  nameOk,
  busy,
  highlightExclude,
  onNetworkChange,
  onAccept,
  onExclude,
  onLink,
}: Props) {
  return (
    <div className="agent-review-actions" onClick={(e) => e.stopPropagation()}>
      <select
        className="agent-review-network-select"
        value={networkCode}
        disabled={busy}
        aria-label="Network"
        onChange={(e) => onNetworkChange(e.target.value)}
      >
        <option value="">Network</option>
        {networks.map((n) => (
          <option key={n.code} value={n.code}>
            {n.code}
          </option>
        ))}
      </select>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              size="sm"
              className="agent-review-add-btn"
              disabled={!nameOk || busy}
              onClick={onAccept}
            />
          }
        >
          <UserPlus size={14} />
          Add
        </TooltipTrigger>
        <TooltipContent>Add as agent</TooltipContent>
      </Tooltip>

      <LinkAgentPicker agents={agents} busy={busy} onPick={onLink} />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button type="button" size="sm" variant="outline" disabled={busy} className="agent-review-exclude-btn" />
          }
        >
          <Ban size={14} />
          Exclude
          <ChevronDown size={14} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {EXCLUDE_REASONS.map((reason) => (
            <DropdownMenuItem
              key={reason}
              className={reason === highlightExclude ? 'agent-review-exclude-item--hint' : undefined}
              onClick={() => onExclude(reason)}
            >
              {EXCLUDE_LABELS[reason]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
