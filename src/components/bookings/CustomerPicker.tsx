import { useEffect, useState } from 'react'
import { useCustomerSearch, type CustomerPickerValue } from '../../hooks/useBookings'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import './customerPicker.css'

export type { CustomerPickerValue }

type Props = {
  label: string
  value: CustomerPickerValue | null
  onChange: (v: CustomerPickerValue | null) => void
  required?: boolean
  compact?: boolean
}

export default function CustomerPicker({ label, value, onChange, required, compact }: Props) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const debounced = useDebouncedValue(text, 300)
  const { data, loading } = useCustomerSearch(debounced)

  useEffect(() => {
    if (!value) setText('')
  }, [value?.account_id, value])

  function select(hit: CustomerPickerValue) {
    onChange(hit)
    setText('')
    setOpen(false)
  }

  function clear() {
    onChange(null)
    setText('')
    setOpen(false)
  }

  const q = text.trim()
  const showMenu = !value && open && q.length >= 2 && (loading || data.length > 0)

  return (
    <div className={`customer-picker${value ? ' customer-picker--selected' : ''}${compact ? ' customer-picker--compact' : ''}`}>
      <div className={`customer-picker__head${compact ? ' customer-picker__head--inline' : ''}`}>
        {label && (
          <label className="customer-picker__label">
            {label}
            {required && <span className="customer-picker__req"> *</span>}
          </label>
        )}
        {value && (
          <span className="customer-picker__chip">
            <span className="customer-picker__chip-name">{value.name}</span>
            <span className="customer-picker__code mono muted">{value.account_id}</span>
            <button type="button" className="customer-picker__clear" onClick={clear} aria-label="Clear selection">
              ×
            </button>
          </span>
        )}
      </div>
      {!value && (
        <div className="customer-picker__wrap">
          <input
            className="input input--sm customer-picker__input"
            value={text}
            required={required}
            placeholder="Search customer name…"
            onChange={(e) => {
              setText(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          />
          {showMenu && (
            <ul className="customer-picker__menu" role="listbox">
              {loading ? (
                <li className="customer-picker__empty muted">Searching…</li>
              ) : (
                data.map((hit) => (
                  <li key={hit.account_id} role="option">
                    <button
                      type="button"
                      className="customer-picker__option"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => select(hit)}
                    >
                      <span className="customer-picker__name">{hit.name}</span>
                      <span className="customer-picker__code mono muted">{hit.account_id}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
