import ImportSeaDateField from '@/features/importSea/ImportSeaDateField'
import { withFieldOverride } from '../bookingFieldOverrides'
import type { BookingRecord, BookingRecordPatch } from '../bookingRecordTypes'
import { isLytteltonPort } from '../tracking/portconnectUtils'
import FormCard from './FormCard'

type PatchFn = (ui: Partial<BookingRecord>, db: BookingRecordPatch) => void

type Props = {
  booking: BookingRecord
  dischargePort: string | null
  onPatch: PatchFn
}

export default function BookingDatesColumn({ booking, dischargePort, onPatch }: Props) {
  const lyttelton = isLytteltonPort(dischargePort)
  const overrides = booking.field_overrides

  return (
    <div className="booking-details-col">
      <FormCard title="Dates">
        <div className="booking-lfd-field">
          <ImportSeaDateField
            label="Last free day"
            value={booking.last_free_day}
            onChange={(iso) =>
              onPatch(
                { last_free_day: iso },
                withFieldOverride({ last_free_day: iso }, 'last_free_day', overrides),
              )
            }
          />
          {lyttelton ? (
            <p className="booking-lfd-field__note muted">
              Lyttelton (NZLYT) — PortConnect does not send LFT events. Enter last free day manually.
            </p>
          ) : null}
        </div>
        <ImportSeaDateField
          label="Discharge date"
          value={booking.discharge_date}
          onChange={(iso) =>
            onPatch(
              { discharge_date: iso },
              withFieldOverride({ discharge_date: iso }, 'discharge_date', overrides),
            )
          }
        />
        <ImportSeaDateField
          label="Delivery date"
          value={booking.delivery_date}
          onChange={(iso) =>
            onPatch(
              { delivery_date: iso },
              withFieldOverride({ delivery_date: iso }, 'delivery_date', overrides),
            )
          }
        />
        <ImportSeaDateField
          label="Container return"
          value={booking.container_return_date}
          onChange={(iso) =>
            onPatch(
              { container_return_date: iso },
              withFieldOverride({ container_return_date: iso }, 'container_return_date', overrides),
            )
          }
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
