import { useMemo } from 'react'
import BookingContainersField from '../containers/BookingContainersField'
import { portConnectLastSync } from '../portConnect/portConnectProvenance'
import type { PortConnectFieldKey } from '../portConnect/portConnectProvenance'
import type { ContainerConflictResolution } from '../containers/bookingContainerTypes'
import type { ContainerListItem } from '../containers/useBookingContainers'
import { aggregatePortConnectBookingFields } from '../portConnect/bookingPortConnectCoalesce'
import type {
  BookingRecord,
  BookingRecordPatch,
  BookingShipment,
} from '../bookingRecordTypes'
import type { ContainerTrackingRow } from '../tracking/trackingTypes'
import AtfAutocomplete from './AtfAutocomplete'
import ShippingLineSelect from './ShippingLineSelect'
import TriSourceField from './TriSourceField'
import FormCard from './FormCard'

type PatchFn = (ui: Partial<BookingRecord>, db: BookingRecordPatch) => void

type Props = {
  booking: BookingRecord
  shipment: BookingShipment | null
  trackingContainers: ContainerTrackingRow[] | null | undefined
  containerRows: ContainerListItem[]
  onAddContainer: () => void
  onSaveContainer: (
    rowId: string,
    payload: { container_no: string; container_type: string | null },
  ) => void
  onRemoveContainer: (rowId: string) => void
  onResolveContainer: (rowId: string, resolution: ContainerConflictResolution) => void
  onOverrideContainer: (rowId: string) => void
  onRevertContainer: (rowId: string) => void
  containerResolveBusy?: boolean
  lastSync?: string | null
  isFlashing?: (key: PortConnectFieldKey) => boolean
  onPatch: PatchFn
}

export default function BookingMiddleColumn({
  booking,
  shipment,
  trackingContainers,
  containerRows,
  onAddContainer,
  onSaveContainer,
  onRemoveContainer,
  onResolveContainer,
  onOverrideContainer,
  onRevertContainer,
  containerResolveBusy,
  lastSync: lastSyncProp,
  isFlashing,
  onPatch,
}: Props) {
  const pc = useMemo(
    () => aggregatePortConnectBookingFields(
      trackingContainers,
      shipment?.destination ?? booking.m_discharge_port,
    ),
    [trackingContainers, shipment?.destination, booking.m_discharge_port],
  )
  const lastSync = lastSyncProp ?? portConnectLastSync(trackingContainers)
  const overrides = booking.field_overrides

  const patchManual = (db: BookingRecordPatch) => {
    onPatch(db as Partial<BookingRecord>, db)
  }

  return (
    <div className="booking-details-col">
      <FormCard title="Shipment">
        <TriSourceField
          label="ETA"
          portConnectValue={pc?.eta ?? null}
          erpValue={shipment?.eta ?? null}
          manualValue={booking.m_eta}
          overrideField="m_eta"
          fieldOverrides={overrides}
          lastSync={lastSync}
          flash={isFlashing?.('m_eta')}
          onManualBlur={patchManual}
        />
        <label className="filter-field booking-form-field">
          <span className="filter-field__label">ATF</span>
          <AtfAutocomplete
            value={booking.m_atf}
            onChange={(code) => onPatch({ m_atf: code }, { m_atf: code })}
          />
        </label>
        <TriSourceField
          label="Shipping line"
          portConnectValue={pc?.shippingLine ?? null}
          erpValue={shipment?.vessel_flight ?? null}
          manualValue={booking.m_shipping_line}
          overrideField="m_shipping_line"
          fieldOverrides={overrides}
          lastSync={lastSync}
          flash={isFlashing?.('m_shipping_line')}
          onManualBlur={patchManual}
        />
        <ShippingLineSelect
          value={booking.shipping_line_code}
          onChange={(code) => onPatch({ shipping_line_code: code }, { shipping_line_code: code })}
        />
        <TriSourceField
          label="Discharge port"
          portConnectValue={pc?.dischargePort ?? null}
          erpValue={shipment?.destination ?? null}
          manualValue={booking.m_discharge_port}
          overrideField="m_discharge_port"
          fieldOverrides={overrides}
          lastSync={lastSync}
          flash={isFlashing?.('m_discharge_port')}
          onManualBlur={patchManual}
        />
        <BookingContainersField
          rows={containerRows}
          trackingContainers={trackingContainers}
          lastSync={lastSync}
          isFlashing={isFlashing}
          onAdd={onAddContainer}
          onSave={onSaveContainer}
          onRemove={onRemoveContainer}
          onResolve={(rowId, resolution) => onResolveContainer(rowId, resolution)}
          fieldOverrides={overrides}
          onOverride={(rowId) => onOverrideContainer(rowId)}
          onRevert={(rowId) => onRevertContainer(rowId)}
          resolveBusy={containerResolveBusy}
          acknowledgedWeights={booking.weight_flags_ack ?? []}
          onToggleWeightAck={(no) => {
            const cur = booking.weight_flags_ack ?? []
            const next = cur.includes(no) ? cur.filter((x) => x !== no) : [...cur, no]
            onPatch({ weight_flags_ack: next }, { weight_flags_ack: next })
          }}
        />
      </FormCard>
    </div>
  )
}
