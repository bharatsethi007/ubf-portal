import { Switch } from '@/components/ui/switch'
import PortConnectEnablementRow from './PortConnectEnablementRow'
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
  lastRefreshedAt: string | null
  onPortConnectSubscribe: () => Promise<void>
  onPortConnectUnsubscribe: () => Promise<void>
  onPortConnectRefresh: () => Promise<void>
  onPatch: (patch: BookingTrackingPatch) => void
}

function CarrierRow({
  settings,
  onPatch,
}: {
  settings: BookingTrackingSettings
  onPatch: (patch: BookingTrackingPatch) => void
}) {
  return (
    <div className="booking-tracking-enable__row">
      <div className="booking-tracking-enable__head">
        <div className="booking-tracking-enable__switch">
          <Switch
            checked={settings.carrier_enabled}
            onCheckedChange={(v) => onPatch({ carrier_enabled: v })}
          />
          <span className="booking-tracking-enable__title">Shipping line tracking</span>
        </div>
      </div>
      <label className="booking-tracking-enable__scac">
        <span className="filter-field__label">Carrier SCAC</span>
        <select
          className="input input--xs"
          value={settings.carrier_scac ?? ''}
          disabled={!settings.carrier_enabled}
          onChange={(e) => onPatch({ carrier_scac: e.target.value.trim() || null })}
        >
          <option value="">Select SCAC…</option>
          {CARRIER_SCAC_OPTIONS.map((scac) => (
            <option key={scac} value={scac}>{scac}</option>
          ))}
        </select>
      </label>
      {settings.carrier_error ? (
        <p className="booking-tracking-enable__error">{settings.carrier_error}</p>
      ) : null}
      {!settings.carrier_enabled ? (
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
  lastRefreshedAt,
  onPortConnectSubscribe,
  onPortConnectUnsubscribe,
  onPortConnectRefresh,
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
      <CarrierRow settings={settings} onPatch={onPatch} />
    </section>
  )
}
