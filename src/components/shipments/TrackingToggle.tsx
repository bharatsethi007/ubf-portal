import { useEffect, useState } from 'react'
import {
  toggleTracking,
  useConsolTracking,
  type ConsolTrackingInfo,
} from '../../hooks/useConsolTracking'
import { useStaff } from '../../hooks/useStaff'
import { TRACKING_TOOLTIP } from '../../utils/consolBill'
import { fmtRelative } from '../../utils/relativeTime'

type Props = {
  consolKey: string
  module: string
  layout?: 'compact' | 'detail'
  stopPropagation?: boolean
  /** Pass from a parent batch fetch (e.g. consols table) to avoid N+1 queries. */
  trackingMap?: Record<string, ConsolTrackingInfo>
  refetchTracking?: () => void
}

function statusText(info: ConsolTrackingInfo | undefined, enabled: boolean): string {
  if (!enabled) return 'Live tracking off — showing TradeWindow timestamps only'
  if (!info?.last_polled_at) return 'Tracking enabled — awaiting first poll'
  return `Last polled ${fmtRelative(info.last_polled_at)} · ${info.last_status ?? '—'}`
}

export default function TrackingToggle({
  consolKey,
  module,
  layout = 'detail',
  stopPropagation,
  trackingMap: externalMap,
  refetchTracking: externalRefetch,
}: Props) {
  const { isStaff } = useStaff()
  const batched = externalMap != null
  const internal = useConsolTracking(batched ? [] : [consolKey])
  const map = batched ? externalMap : internal.map
  const refetch = externalRefetch ?? internal.refetch

  const [optimistic, setOptimistic] = useState<boolean | null>(null)
  const [toggling, setToggling] = useState(false)

  const info = map[consolKey]
  const enabled = optimistic ?? info?.enabled ?? false

  useEffect(() => {
    if (optimistic != null && info?.enabled === optimistic) setOptimistic(null)
  }, [info?.enabled, optimistic])

  if (!isStaff) return null

  async function onChange(next: boolean) {
    setOptimistic(next)
    setToggling(true)
    try {
      await toggleTracking(consolKey, module, next)
      refetch()
    } catch {
      setOptimistic(null)
    } finally {
      setToggling(false)
    }
  }

  const toggle = (
    <label
      className="toggle tracking-toggle__switch"
      title={TRACKING_TOOLTIP}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
    >
      <input type="checkbox" checked={enabled} disabled={toggling} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle__track" />
    </label>
  )

  if (layout === 'compact') return toggle

  return (
    <div className="tracking-toggle">
      <div className="tracking-toggle__row">
        <span className="tracking-toggle__label">Enable Tracking Bot</span>
        {toggle}
      </div>
      <p className="tracking-toggle__status muted">{statusText(info, enabled)}</p>
    </div>
  )
}
