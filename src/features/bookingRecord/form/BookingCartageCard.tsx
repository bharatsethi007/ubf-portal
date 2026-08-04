import { MailPlus } from 'lucide-react'
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

      {booking.m_atf?.trim() === '31853' ? (
        <>
          {(() => {
            const BAY_COLORS = ['#FFD6D6','#FFE7CC','#FFF6CC','#E6F7D0','#D2F4EA','#D6EEFF','#DCE4FF','#E7DBFF','#F6D6FF','#FFD6EC']
            const bayIdx = booking.ubf_bay ? Number(booking.ubf_bay.replace(/\D/g, '')) - 1 : -1
            const bayBg = bayIdx >= 0 && bayIdx < 10 ? BAY_COLORS[bayIdx] : undefined
            return (
              <label className="filter-field booking-form-field">
                <span className="filter-field__label">UBF Bay</span>
                <select
                  className="input input--sm"
                  value={booking.ubf_bay ?? ''}
                  style={bayBg ? { background: bayBg, fontWeight: 600, color: '#344054' } : undefined}
                  onChange={(e) => {
                    const v = e.target.value || null
                    onPatch({ ubf_bay: v }, { ubf_bay: v })
                  }}
                >
                  <option value="">Select bay…</option>
                  {BAY_COLORS.map((c, i) => (
                    <option key={i} value={`Bay ${i + 1}`} style={{ background: c, color: '#344054' }}>
                      Bay {i + 1}
                    </option>
                  ))}
                </select>
              </label>
            )
          })()}

          <div style={{ display: 'flex', gap: 8 }}>
            <label className="filter-field booking-form-field" style={{ flex: 1, minWidth: 0 }}>
              <span className="filter-field__label">Time slot</span>
              <select
                className="input input--sm"
                value={booking.ubf_time_slot ?? ''}
                onChange={(e) => {
                  const v = e.target.value || null
                  onPatch({ ubf_time_slot: v }, { ubf_time_slot: v })
                }}
              >
                <option value="">Select slot…</option>
                <option value="Morning">Morning</option>
                <option value="Afternoon">Afternoon</option>
                <option value="Night">Night</option>
              </select>
            </label>
            <label className="filter-field booking-form-field" style={{ flex: 1, minWidth: 0 }}>
              <span className="filter-field__label">Devanner</span>
              <select
                className="input input--sm"
                value={booking.ubf_devanner ?? ''}
                onChange={(e) => {
                  const v = e.target.value || null
                  onPatch({ ubf_devanner: v }, { ubf_devanner: v })
                }}
              >
                <option value="">Select…</option>
                <option value="UBF">UBF</option>
                <option value="Lee">Lee</option>
              </select>
            </label>
          </div>
        </>
      ) : null}

      <div className="booking-cartage__date-row">
        <ImportSeaDateField
          label="Delivery date"
          value={booking.delivery_date ?? deliveryPrefill}
          onChange={(iso) => onPatch({ delivery_date: iso }, { delivery_date: iso })}
        />
        <button
          type="button"
          className="text-link booking-cartage__email-btn"
          title="Open in Outlook"
          aria-label="Open in Outlook"
          onClick={onEmailDelivery}
        >
          <MailPlus size={16} />
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
          title="Open in Outlook"
          aria-label="Open in Outlook"
          onClick={onEmailEmptyPickup}
        >
          <MailPlus size={16} />
        </button>
      </div>
    </FormCard>
  )
}
