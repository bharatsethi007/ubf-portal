type Props = {
  label: string
  erpValue: string | null
  manualValue: string | null
  onManualBlur: (next: string | null) => void
}

export default function DualSourceField({
  label,
  erpValue,
  manualValue,
  onManualBlur,
}: Props) {
  if (erpValue) {
    return (
      <label className="filter-field booking-form-field">
        <span className="filter-field__label">{label}</span>
        <div className="booking-erp-readonly">
          <span className="mono">{erpValue}</span>
          <span className="booking-erp-tag">from ERP</span>
        </div>
      </label>
    )
  }

  return (
    <label className="filter-field booking-form-field">
      <span className="filter-field__label">{label}</span>
      <input
        type="text"
        className="input input--sm"
        defaultValue={manualValue ?? ''}
        onBlur={(e) => {
          const next = e.target.value.trim() || null
          const prev = manualValue?.trim() || null
          if (next !== prev) onManualBlur(next)
        }}
      />
    </label>
  )
}
