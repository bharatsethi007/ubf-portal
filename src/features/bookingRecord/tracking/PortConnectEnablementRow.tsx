import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { usePortConnectDetail } from '../portConnect/PortConnectDetailProvider'
import PortConnectTrackTraceTable from './PortConnectTrackTraceTable'
import { buildPortConnectVisitViews } from './portConnectVisitView'
import { relativeUpdatedAt } from './trackingFormat'
import type {
  BookingTrackingEvent,
  BookingTrackingSettings,
  ContainerTrackingRow,
  PortConnectVisitView,
} from './trackingTypes'

type Props = {
  settings: BookingTrackingSettings
  containerNumbers: string[]
  containers: ContainerTrackingRow[]
  events: BookingTrackingEvent[]
  containersTracked: number
  busy: boolean
  refreshBusy: boolean
  lastRefreshedAt: string | null
  onSubscribe: () => void
  onUnsubscribe: () => void
  onRefresh: () => void
}

export default function PortConnectEnablementRow({
  settings,
  containerNumbers,
  containers,
  events,
  containersTracked,
  busy,
  refreshBusy,
  lastRefreshedAt,
  onSubscribe,
  onUnsubscribe,
  onRefresh,
}: Props) {
  const [pending, setPending] = useState(false)
  const { openVisit } = usePortConnectDetail()
  const noContainers = containerNumbers.length === 0
  const enabled = settings.portconnect_enabled
  const actionBusy = busy || refreshBusy

  const visits = useMemo(
    () => buildPortConnectVisitViews(containers ?? [], events ?? []),
    [containers, events],
  )

  const handleToggle = async (next: boolean) => {
    if (actionBusy || pending) return
    if (next && noContainers) return
    setPending(true)
    try {
      if (next) await onSubscribe()
      else await onUnsubscribe()
    } finally {
      setPending(false)
    }
  }

  const handleSelect = (visit: PortConnectVisitView) => {
    openVisit(visit, null)
  }

  return (
    <div className="booking-tracking-enable__row">
      <div className="booking-tracking-enable__head">
        <div className="booking-tracking-enable__switch">
          <Switch
            checked={enabled}
            disabled={actionBusy || pending || (noContainers && !enabled)}
            onCheckedChange={(v) => void handleToggle(v)}
          />
          <span className="booking-tracking-enable__title">PortConnect tracking</span>
        </div>
        <div className="booking-tracking-enable__actions">
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={actionBusy || pending || noContainers || !enabled}
            onClick={() => void onRefresh()}
          >
            <RefreshCw size={13} className={refreshBusy ? 'import-sea-spin' : undefined} />
            Refresh
          </Button>
        </div>
      </div>

      <dl className="booking-pc-subscription-meta">
        <div>
          <dt>Last refreshed</dt>
          <dd>{lastRefreshedAt ? relativeUpdatedAt(lastRefreshedAt) : 'Never'}</dd>
        </div>
        <div>
          <dt>Containers tracked</dt>
          <dd>{containersTracked}</dd>
        </div>
        <div className="booking-pc-subscription-meta__full">
          <dt>On booking</dt>
          <dd className="mono">{containerNumbers.join(', ') || '—'}</dd>
        </div>
      </dl>

      <PortConnectTrackTraceTable visits={visits} onSelect={handleSelect} embedded />

      {noContainers ? (
        <p className="booking-tracking-enable__warn">
          Enter at least one container number on the Details tab before enabling PortConnect.
        </p>
      ) : null}
      {settings.portconnect_error ? (
        <p className="booking-tracking-enable__error">{settings.portconnect_error}</p>
      ) : null}
      {!enabled && !noContainers ? (
        <p className="muted booking-tracking-enable__placeholder">
          Turn on PortConnect tracking, then use Refresh to pull the latest visit data on demand.
        </p>
      ) : null}
    </div>
  )
}
