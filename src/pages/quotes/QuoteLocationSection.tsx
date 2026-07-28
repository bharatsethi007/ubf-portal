import type { QuoteDraft } from './quotesApi'

type Side = 'origin' | 'destination'

const FIELDS: Record<
  Side,
  {
    title: string
    locationType: keyof QuoteDraft
    date: keyof QuoteDraft
    location: keyof QuoteDraft
    postal: keyof QuoteDraft
    address: keyof QuoteDraft
    dateLabel: string
    locationLabel: string
    addressLabel: string
  }
> = {
  origin: {
    title: 'Origin',
    locationType: 'origin_location_type',
    date: 'pickup_date',
    location: 'pickup_location',
    postal: 'pickup_postal_code',
    address: 'pickup_address',
    dateLabel: 'Pickup Date',
    locationLabel: 'Pickup Location',
    addressLabel: 'Pickup Address',
  },
  destination: {
    title: 'Destination',
    locationType: 'dest_location_type',
    date: 'delivery_date',
    location: 'drop_location',
    postal: 'drop_postal_code',
    address: 'drop_address',
    dateLabel: 'Delivery Date',
    locationLabel: 'Drop Location',
    addressLabel: 'Drop Address',
  },
}

type Props = {
  side: Side
  draft: QuoteDraft
  onPatch: (patch: Partial<QuoteDraft>) => void
}

export default function QuoteLocationSection({ side, draft, onPatch }: Props) {
  const f = FIELDS[side]
  const str = (key: keyof QuoteDraft) => (draft[key] as string | null) ?? ''

  return (
    <section className="quote-form__location card booking-form-card">
      <h3 className="booking-form-card__title">{f.title}</h3>
      <div className="booking-form-card__body quote-form__location-body">
        <label className="filter-field booking-form-field">
          <span className="filter-field__label">Location Type</span>
          <input
            type="text"
            className="input input--sm"
            value={str(f.locationType)}
            onChange={(e) => onPatch({ [f.locationType]: e.target.value || null })}
          />
        </label>
        <label className="filter-field booking-form-field">
          <span className="filter-field__label">{f.dateLabel}</span>
          <input
            type="date"
            className="input input--sm"
            value={str(f.date)}
            onChange={(e) => onPatch({ [f.date]: e.target.value || null })}
          />
        </label>
        <label className="filter-field booking-form-field">
          <span className="filter-field__label">{f.locationLabel}</span>
          <input
            type="text"
            className="input input--sm"
            value={str(f.location)}
            onChange={(e) => onPatch({ [f.location]: e.target.value || null })}
          />
        </label>
        <label className="filter-field booking-form-field">
          <span className="filter-field__label">Postal code</span>
          <input
            type="text"
            className="input input--sm"
            value={str(f.postal)}
            onChange={(e) => onPatch({ [f.postal]: e.target.value || null })}
          />
        </label>
        <label className="filter-field booking-form-field">
          <span className="filter-field__label">{f.addressLabel}</span>
          <textarea
            className="input input--sm quote-form__textarea"
            rows={3}
            value={str(f.address)}
            onChange={(e) => onPatch({ [f.address]: e.target.value || null })}
          />
        </label>
      </div>
    </section>
  )
}
