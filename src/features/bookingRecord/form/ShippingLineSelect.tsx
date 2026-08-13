import { useShippingLines } from '@/hooks/useQuoteRefData'

type Props = { value: string | null; onChange: (code: string | null) => void }

export default function ShippingLineSelect({ value, onChange }: Props) {
  const { items, loading } = useShippingLines()
  return (
    <label className="filter-field booking-form-field">
      <span className="filter-field__label">Carrier / line (tracking)</span>
      <select
        className="input input--sm"
        value={value ?? ''}
        disabled={loading}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">Select carrier…</option>
        {items.map((l) => (
          <option key={l.code} value={l.code}>{l.name}</option>
        ))}
      </select>
    </label>
  )
}
