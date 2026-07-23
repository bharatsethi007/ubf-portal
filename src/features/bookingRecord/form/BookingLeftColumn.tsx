import type {
  BookingRecord,
  BookingRecordPatch,
  StaffUser,
} from '../bookingRecordTypes'
import CustomerField, { customerPickerValue } from './CustomerField'
import FormCard from './FormCard'
import StaffField from './StaffField'

type PatchFn = (ui: Partial<BookingRecord>, db: BookingRecordPatch) => void

type Props = {
  booking: BookingRecord
  staff: StaffUser[]
  onPatch: PatchFn
}

export default function BookingLeftColumn({ booking, staff, onPatch }: Props) {
  const client = customerPickerValue(booking.account_id, booking.customer_name)
  const consignee = customerPickerValue(booking.consignee_account_id, booking.consignee_name)
  const importer = customerPickerValue(booking.importer_account_id, booking.importer_name)

  function patchCustomer(ui: Partial<BookingRecord>, db: BookingRecordPatch) {
    onPatch(ui, db)
  }

  return (
    <div className="booking-details-col">
      <FormCard title="Booking">
        <CustomerField
          label="Client"
          value={client}
          onChange={(c) =>
            patchCustomer(
              { account_id: c?.account_id ?? null, customer_name: c?.name ?? null },
              { account_id: c?.account_id ?? null },
            )
          }
        />
        <CustomerField
          label="Consignee"
          value={consignee}
          onChange={(c) =>
            patchCustomer(
              { consignee_account_id: c?.account_id ?? null, consignee_name: c?.name ?? null },
              { consignee_account_id: c?.account_id ?? null },
            )
          }
        />
        <CustomerField
          label="Importer"
          value={importer}
          onChange={(c) =>
            patchCustomer(
              { importer_account_id: c?.account_id ?? null, importer_name: c?.name ?? null },
              { importer_account_id: c?.account_id ?? null },
            )
          }
        />
        <label className="filter-field booking-form-field">
          <span className="filter-field__label">Booking ref</span>
          <input type="text" className="input input--xs" value={booking.booking_ref ?? ''} readOnly />
        </label>
        <label className="filter-field booking-form-field">
          <span className="filter-field__label">Job #</span>
          <input
            type="text"
            className="input input--xs mono"
            defaultValue={booking.job_no ?? ''}
            onBlur={(e) => {
              const next = e.target.value.trim() || null
              if (next !== (booking.job_no?.trim() || null)) onPatch({ job_no: next }, { job_no: next })
            }}
          />
        </label>
        <label className="filter-field booking-form-field">
          <span className="filter-field__label">Mode</span>
          <input
            type="text"
            className="input input--xs"
            defaultValue={booking.mode ?? ''}
            onBlur={(e) => {
              const next = e.target.value.trim() || null
              if (next !== (booking.mode?.trim() || null)) onPatch({ mode: next }, { mode: next })
            }}
          />
        </label>
        <StaffField
          value={booking.handled_by}
          staff={staff}
          onChange={(userId) => onPatch({ handled_by: userId }, { handled_by: userId })}
        />
      </FormCard>
    </div>
  )
}
