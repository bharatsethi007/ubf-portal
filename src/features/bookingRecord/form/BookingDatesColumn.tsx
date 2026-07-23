import { useMemo } from 'react'
import { aggregatePortConnectBookingFields } from '../portConnect/bookingPortConnectCoalesce'
import { portConnectLastSync } from '../portConnect/portConnectProvenance'
import type { PortConnectFieldKey } from '../portConnect/portConnectProvenance'
import { withFieldOverride } from '../bookingFieldOverrides'
import type { BookingRecord, BookingRecordPatch } from '../bookingRecordTypes'
import type { ContainerTrackingRow } from '../tracking/trackingTypes'
import { isLytteltonPort } from '../tracking/portconnectUtils'
import TriSourceDateField from './TriSourceDateField'
import ImportSeaDateField from '@/features/importSea/ImportSeaDateField'
import FormCard from './FormCard'

type PatchFn = (ui: Partial<BookingRecord>, db: BookingRecordPatch) => void

type Props = {
  booking: BookingRecord
  dischargePort: string | null
  trackingContainers: ContainerTrackingRow[] | null | undefined
  lastSync?: string | null
  isFlashing?: (key: PortConnectFieldKey) => boolean
  onPatch: PatchFn
}

export default function BookingDatesColumn({
  booking,
  dischargePort,
  trackingContainers,
  lastSync: lastSyncProp,
  isFlashing,
  onPatch,
}: Props) {
  const lyttelton = isLytteltonPort(dischargePort)
  const overrides = booking.field_overrides
  const lastSync = lastSyncProp ?? portConnectLastSync(trackingContainers)
  const pc = useMemo(
    () => aggregatePortConnectBookingFields(trackingContainers, dischargePort),
    [trackingContainers, dischargePort],
  )

  const patchDb = (db: BookingRecordPatch) => {
    onPatch(db as Partial<BookingRecord>, db)
  }

  return (
    <div className="booking-details-col">
      <FormCard title="Dates">
        <div className="booking-lfd-field">
          {lyttelton || !pc?.lastFreeDay ? (
            <ImportSeaDateField
              label="Last free day"
              value={booking.last_free_day}
              onChange={(iso) =>
                patchDb(withFieldOverride({ last_free_day: iso }, 'last_free_day', overrides))
              }
            />
          ) : (
            <TriSourceDateField
              label="Last free day"
              portConnectValue={pc.lastFreeDay}
              manualValue={booking.last_free_day}
              overrideField="last_free_day"
              fieldOverrides={overrides}
              lastSync={lastSync}
              flash={isFlashing?.('last_free_day')}
              onPatch={patchDb}
            />
          )}
          {lyttelton ? (
            <p className="booking-lfd-field__note muted">
              Lyttelton (NZLYT) — PortConnect does not send LFT events. Enter last free day manually.
            </p>
          ) : null}
        </div>
        <TriSourceDateField
          label="Discharge date"
          portConnectValue={pc?.dischargeDate ?? null}
          manualValue={booking.discharge_date}
          overrideField="discharge_date"
          fieldOverrides={overrides}
          lastSync={lastSync}
          flash={isFlashing?.('discharge_date')}
          onPatch={patchDb}
        />
        <TriSourceDateField
          label="Delivery date"
          portConnectValue={pc?.deliveryDate ?? null}
          manualValue={booking.delivery_date}
          overrideField="delivery_date"
          fieldOverrides={overrides}
          lastSync={lastSync}
          flash={isFlashing?.('delivery_date')}
          onPatch={patchDb}
        />
        <TriSourceDateField
          label="Container return"
          portConnectValue={pc?.containerReturnDate ?? null}
          manualValue={booking.container_return_date}
          overrideField="container_return_date"
          fieldOverrides={overrides}
          lastSync={lastSync}
          flash={isFlashing?.('container_return_date')}
          onPatch={patchDb}
        />
        <ImportSeaDateField
          label="Doc handover"
          value={booking.doc_handover_at?.slice(0, 10) ?? null}
          onChange={(iso) =>
            onPatch(
              { doc_handover_at: iso ? `${iso}T12:00:00Z` : null },
              { doc_handover_at: iso ? `${iso}T12:00:00Z` : null },
            )
          }
        />
      </FormCard>
    </div>
  )
}
