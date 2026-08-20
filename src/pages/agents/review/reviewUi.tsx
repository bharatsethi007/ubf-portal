import { ArrowDown, ArrowUp } from 'lucide-react'
import { fmt } from '../../../components/Customers/profileUi'

const CLASS_BADGE: Record<string, string> = {
  agent: 'agent-review-class-badge--agent',
  customer: 'agent-review-class-badge--customer',
  carrier: 'agent-review-class-badge--carrier',
  unknown: 'agent-review-class-badge--unknown',
}

export function SuggestedClassBadge({ value }: { value: string | null }) {
  const key = (value ?? 'unknown').toLowerCase()
  const cls = CLASS_BADGE[key] ?? CLASS_BADGE.unknown
  const label = key === 'unknown' && !value ? 'Unknown' : key
  return (
    <span className={`agent-review-class-badge ${cls}`}>
      {label}
    </span>
  )
}

export function ImpExpCell({ imp, exp }: { imp: number; exp: number }) {
  return (
    <span className="agent-review-imp-exp">
      <ArrowDown size={12} strokeWidth={2.25} aria-hidden />
      <span>{fmt.int(imp)}</span>
      <ArrowUp size={12} strokeWidth={2.25} aria-hidden />
      <span>{fmt.int(exp)}</span>
    </span>
  )
}
