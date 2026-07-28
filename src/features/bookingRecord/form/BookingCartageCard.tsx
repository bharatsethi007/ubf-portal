import ImportSeaDateField from '@/features/importSea/ImportSeaDateField'
import type { BookingRecord, BookingRecordPatch } from '../bookingRecordTypes'
import FormCard from './FormCard'

type Props = {
  booking: BookingRecord
  deliveryPrefill: string | null
  onPatch: (ui: Partial<BookingRecord>, db: BookingRecordPatch) => void
  onEmailDelivery: () => void
  onEmailEmptyPickup: () => void
}

export default function BookingCartageCard({
  booking,
  deliveryPrefill,
  onPatch,
  onEmailDelivery,
  onEmailEmptyPickup,
}: Props) {
  return (
    <FormCard title="Cartage">
      <label className="filter-field booking-form-field">
        <span className="filter-field__label">Door direction</span>
        <select
          className="input input--sm"
          value={booking.door_direction ?? ''}
          onChange={(e) => {
            const v = (e.target.value || null) as BookingRecord['door_direction']
            onPatch({ door_direction: v }, { door_direction: v })
          }}
        >
          <option value="">Select…</option>
          <option value="front">Door to Front</option>
          <option value="rear">Door to Rear</option>
        </select>
      </label>

      <label className="filter-field booking-form-field">
        <span className="filter-field__label">Peak / Off-peak</span>
        <select
          className="input input--sm"
          value={booking.pickup_peak ?? ''}
          onChange={(e) => {
            const v = (e.target.value || null) as BookingRecord['pickup_peak']
            onPatch({ pickup_peak: v }, { pickup_peak: v })
          }}
        >
          <option value="">Select…</option>
          <option value="peak">Peak</option>
          <option value="offpeak">Off peak</option>
        </select>
      </label>

      <div className="booking-cartage__date-row">
        <ImportSeaDateField
          label="Delivery date"
          value={booking.delivery_date ?? deliveryPrefill}
          onChange={(iso) => onPatch({ delivery_date: iso }, { delivery_date: iso })}
        />
        <button
          type="button"
          className="text-link booking-cartage__email-btn"
          onClick={onEmailDelivery}
        >
          Email
        </button>
      </div>

      <div className="booking-cartage__date-row">
        <ImportSeaDateField
          label="Empty pickup date"
          value={booking.empty_pickup_date}
          onChange={(iso) => onPatch({ empty_pickup_date: iso }, { empty_pickup_date: iso })}
        />
        <button
          type="button"
          className="text-link booking-cartage__email-btn"
          onClick={onEmailEmptyPickup}
        >
          Email
        </button>
      </div>
    </FormCard>
  )
}
