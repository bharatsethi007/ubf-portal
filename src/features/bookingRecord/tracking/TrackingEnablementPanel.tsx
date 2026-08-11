import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import PortConnectEnablementRow from './PortConnectEnablementRow'
import CarrierEventsList from './CarrierEventsList'
import { relativeUpdatedAt } from './trackingFormat'
import type {
  BookingTrackingEvent,
  BookingTrackingPatch,
  BookingTrackingSettings,
  ContainerTrackingRow,
} from './trackingTypes'
import { CARRIER_SCAC_OPTIONS } from './trackingConstants'

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
  const hasScac = Boolean((settings.carrier_scac ?? '').trim())
  const carrierEventCount = events.filter((ev) => ev.source === 'carrier').length

  return (
    <div className="booking-tracking-enable__row">
      <div className="booking-tracking-enable__head">
        <div className="booking-tracking-enable__switch">
          <Switch
            checked={enabled}
            onCheckedChange={(v) => onPatch({ carrier_enabled: v })}
          />
          <span className="booking-tracking-enable__title">Shipping line tracking</span>
        </div>
        <div className="booking-tracking-enable__actions">
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={carrierBusy || !enabled || !hasScac}
            onClick={() => void onCarrierRefresh()}
          >
            <RefreshCw size={13} className={carrierBusy ? 'import-sea-spin' : undefined} />
            Refresh
          </Button>
        </div>
      </div>

      <label className="booking-tracking-enable__scac">
        <span className="filter-field__label">Carrier SCAC</span>
        <select
          className="input input--xs"
          value={settings.carrier_scac ?? ''}
          disabled={!enabled}
          onChange={(e) => onPatch({ carrier_scac: e.target.value.trim() || null })}
        >
          <option value="">Select SCAC…</option>
          {CARRIER_SCAC_OPTIONS.map((scac) => (
            <option key={scac} value={scac}>{scac}</option>
          ))}
        </select>
      </label>

      {enabled ? (
        <dl className="booking-pc-subscription-meta">
          <div>
            <dt>Last refreshed</dt>
            <dd>{settings.last_carrier_sync ? relativeUpdatedAt(settings.last_carrier_sync) : 'Never'}</dd>
          </div>
          <div>
            <dt>Events</dt>
            <dd>{carrierEventCount}</dd>
          </div>
        </dl>
      ) : null}

      <CarrierEventsList events={events} />

      {settings.carrier_error ? (
        <p className="booking-tracking-enable__error">{settings.carrier_error}</p>
      ) : null}
      {enabled && !hasScac ? (
        <p className="muted booking-tracking-enable__placeholder">
          Select the carrier SCAC (e.g. MAEU for Maersk), then use Refresh to pull events.
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
