import { BadgeCheck } from 'lucide-react'

type Props = {
  size?: number
  title?: string
}

export default function AgentTrustedTick({
  size = 22,
  title = 'Trusted — approved for shipment assignment',
}: Props) {
  return (
    <span className="agent-trusted-tick" title={title}>
      <BadgeCheck size={size} strokeWidth={2.2} />
    </span>
  )
}
