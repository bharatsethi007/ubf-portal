import type { PortalRange } from '../dashboard/portalFormat'
import { RANGE_LABELS } from '../dashboard/portalFormat'

const KEYS: PortalRange[] = ['year', 'month', 'week', 'today', 'custom']

type Props = {
  value: PortalRange
  onChange: (v: PortalRange) => void
}

export default function RangeTabs({ value, onChange }: Props) {
  return (
    <div className="portal-seg-wrap" role="tablist" aria-label="Time range">
      {KEYS.map((k) => (
        <button key={k} type="button" role="tab" aria-selected={value === k}
          className={`portal-seg${value === k ? ' portal-seg--on' : ''}`}
          onClick={() => onChange(k)}>
          {RANGE_LABELS[k]}
        </button>
      ))}
    </div>
  )
}
