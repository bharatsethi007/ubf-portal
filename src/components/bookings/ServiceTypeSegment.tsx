import type { BookingServiceType } from '../../types/booking'
import { SERVICE_TYPES } from '../../pages/bookings/formUi'
import './serviceTypeSegment.css'

type Props = {
  value: BookingServiceType | ''
  onChange: (v: BookingServiceType) => void
}

export default function ServiceTypeSegment({ value, onChange }: Props) {
  return (
    <div className="bf-segment" role="radiogroup" aria-label="Service type">
      {SERVICE_TYPES.map(({ value: v, label }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          className={`bf-segment__item${value === v ? ' bf-segment__item--active' : ''}`}
          onClick={() => onChange(v)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
