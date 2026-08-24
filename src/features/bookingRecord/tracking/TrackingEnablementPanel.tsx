import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import PortConnectEnablementRow from './PortConnectEnablementRow'
import { relativeUpdatedAt } from './trackingFormat'
import { deriveCarrierName } from './carrierNames'
import type {
  BookingTrackingEvent,
  BookingTrackingPatch,
  BookingTrackingSettings,
  ContainerTrackingRow,
} from './trackingTypes'

type Props = {
  settings: BookingTrackingSettings
  containerNumbers: string[]
  containers: ContainerTrackingRow[]
  events: BookingTrackingEvent[]
  containersTracked: number
  portConnectBusy: boolean
  refreshBusy: boolean
  carrierBusy: boolean
  lastRefreshedAt: string | null
  onPortConnectSubscribe: () => Promise<void>
  onPortConnectUnsubscribe: () => Promise<void>
  onPortConnectRefresh: () => Promise<void>
  onCarrierRefresh: () => Promise<void>
  onPatch: (patch: BookingTrackingPatch) => void
}

function CarrierRow({
  settings,
  events,
  carrierBusy,
  onCarrierRefresh,
  onPatch,
}: {
  settings: BookingTrackingSettings
  events: BookingTrackingEvent[]
  carrierBusy: boolean
  onCarrierRefresh: () => Promise<void>
  onPatch: (patch: BookingTrackingPatch) => void
}) {
  const enabled = settings.carrier_enabled
  const carrierEventCount = events.filter(
    (ev) => ev.source === 'carrier' || ev.source === 'seavantage',
  ).length
  const matchedCarrier = deriveCarrierName(events)
  const lastSync = [settings.last_seavantage_sync, settings.last_carrier_sync]
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1) ?? null
  const svSync = settings.last_seavantage_sync ? new Date(settings.last_seavantage_sync).getTime() : 0
  const carrierSync = settings.last_carrier_sync ? new Date(settings.last_carrier_sync).getTime() : 0
  const lineError = svSync >= carrierSync ? settings.seavantage_error : settings.carrier_error

  return (
    <div className="booking-tracking-enable__row">
      <div className="booking-tracking-enable__head">
        <div className="booking-tracking-enable__switch">
          <Switch
            checked={enabled}
            onCheckedChange={(v) => onPatch({ carrier_enabled: v })}
          />
          <span className="booking-tracking-enable__title">Shipping line tracking</span>
          {matchedCarrier ? (
            <span className="ml-2 rounded bg-[#0A2472]/10 px-1.5 py-0.5 text-[11px] font-medium text-[#0A2472]">
              {matchedCarrier}
            </span>
          ) : null}
        </div>
        <div className="booking-tracking-enable__actions">
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={carrierBusy || !enabled}
            onClick={() => void onCarrierRefresh()}
          >
            <RefreshCw size={13} className={carrierBusy ? 'import-sea-spin' : undefined} />
            Refresh
          </Button>
        </div>
      </div>

      {enabled ? (
        <dl className="booking-pc-subscription-meta">
          <div>
            <dt>Last refreshed</dt>
            <dd>{lastSync ? relativeUpdatedAt(lastSync) : 'Never'}</dd>
          </div>
          <div>
            <dt>Events</dt>
            <dd>{carrierEventCount}</dd>
          </div>
        </dl>
      ) : null}

      {lineError ? (
        <p className="booking-tracking-enable__error">{lineError}</p>
      ) : null}
      {enabled && carrierEventCount === 0 ? (
        <p className="muted booking-tracking-enable__placeholder">
          Maersk auto-detects from the container; other lines use the carrier picked on the booking. Click Refresh to pull events.
        </p>
      ) : null}
      {!enabled ? (
        <p className="muted booking-tracking-enable__placeholder">
          Shipping line tracking is not enabled for this booking.
        </p>
      ) : null}
    </div>
  )
}

export default function TrackingEnablementPanel({
  settings,
  containerNumbers,
  containers,
  events,
  containersTracked,
  portConnectBusy,
  refreshBusy,
  carrierBusy,
  lastRefreshedAt,
  onPortConnectSubscribe,
  onPortConnectUnsubscribe,
  onPortConnectRefresh,
  onCarrierRefresh,
  onPatch,
}: Props) {
  return (
    <section className="card booking-tracking-enable">
      <PortConnectEnablementRow
        settings={settings}
        containerNumbers={containerNumbers}
        containers={containers}
        events={events}
        containersTracked={containersTracked}
        busy={portConnectBusy}
        refreshBusy={refreshBusy}
        lastRefreshedAt={lastRefreshedAt}
        onSubscribe={() => void onPortConnectSubscribe()}
        onUnsubscribe={() => void onPortConnectUnsubscribe()}
        onRefresh={() => void onPortConnectRefresh()}
      />
      <CarrierRow
        settings={settings}
        events={events}
        carrierBusy={carrierBusy}
        onCarrierRefresh={onCarrierRefresh}
        onPatch={onPatch}
      />
    </section>
  )
}
