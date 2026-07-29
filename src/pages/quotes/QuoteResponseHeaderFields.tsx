import type { QuoteResponseHeader } from './quoteResponsesApi'

type Props = {
  header: QuoteResponseHeader
  onPatch: (patch: Partial<QuoteResponseHeader>) => void
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string | null
  onChange: (v: string | null) => void
  type?: string
}) {
  return (
    <label className="filter-field booking-form-field">
      <span className="filter-field__label">{label}</span>
      <input
        type={type}
        className="input input--sm"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      />
    </label>
  )
}

export default function QuoteResponseHeaderFields({ header, onPatch }: Props) {
  return (
    <>
      <div className="quote-form__grid">
        <TextField label="Quotation Date" type="date" value={header.quotation_date} onChange={(v) => onPatch({ quotation_date: v })} />
        <TextField label="Valid From" type="date" value={header.valid_from} onChange={(v) => onPatch({ valid_from: v })} />
        <TextField label="Valid Till" type="date" value={header.valid_till} onChange={(v) => onPatch({ valid_till: v })} />
        <TextField label="ETD" type="date" value={header.etd} onChange={(v) => onPatch({ etd: v })} />
        <TextField label="ETA" type="date" value={header.eta} onChange={(v) => onPatch({ eta: v })} />
        <TextField label="Carrier / Airline" value={header.carrier} onChange={(v) => onPatch({ carrier: v })} />
        <TextField label="Via Port" value={header.via_port} onChange={(v) => onPatch({ via_port: v })} />
        <TextField label="Transit Time Days" type="number" value={header.transit_time_days} onChange={(v) => onPatch({ transit_time_days: v })} />
        <TextField label="Origin Free Time Days" type="number" value={header.origin_free_time_days} onChange={(v) => onPatch({ origin_free_time_days: v })} />
        <TextField label="Detention Free Time Dest" type="number" value={header.detention_free_time_dest} onChange={(v) => onPatch({ detention_free_time_dest: v })} />
        <TextField label="Product" value={header.product} onChange={(v) => onPatch({ product: v })} />
        <TextField label="Currency" value={header.currency} onChange={(v) => onPatch({ currency: v })} />
        <TextField label="Exchange Rate" type="number" value={header.exchange_rate} onChange={(v) => onPatch({ exchange_rate: v })} />
      </div>
      <div className="quote-form__flags quote-response__flags">
        <label className="check-row">
          <input
            type="checkbox"
            checked={header.include_payment_link}
            onChange={(e) => onPatch({ include_payment_link: e.target.checked })}
          />
          Include Payment Link
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={header.enable_fixed_items}
            onChange={(e) => onPatch({ enable_fixed_items: e.target.checked })}
          />
          Enable Fixed Items
        </label>
      </div>
      <label className="filter-field booking-form-field">
        <span className="filter-field__label">Customer Notes</span>
        <textarea
          className="input input--sm quote-form__textarea"
          rows={3}
          value={header.customer_notes ?? ''}
          onChange={(e) => onPatch({ customer_notes: e.target.value || null })}
        />
      </label>
      <label className="filter-field booking-form-field">
        <span className="filter-field__label">Terms And Conditions</span>
        <textarea
          className="input input--sm quote-form__textarea"
          rows={3}
          value={header.terms_conditions ?? ''}
          onChange={(e) => onPatch({ terms_conditions: e.target.value || null })}
        />
      </label>
    </>
  )
}
