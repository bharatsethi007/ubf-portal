import { useEffect, useState } from 'react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useCustomerSearch, type CustomerPickerValue } from '@/hooks/useBookings'

type Props = {
  label: string
  value: CustomerPickerValue | null
  onChange: (next: CustomerPickerValue | null) => void
}

export default function CustomerField({ label, value, onChange }: Props) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const debounced = useDebouncedValue(text, 300)
  const { data, loading } = useCustomerSearch(debounced)

  useEffect(() => {
    if (value) setText(value.name)
  }, [value?.account_id, value?.name])

  function pick(hit: CustomerPickerValue) {
    onChange(hit)
    setText(hit.name)
    setOpen(false)
  }

  return (
    <label className="filter-field booking-form-field">
      <span className="filter-field__label">{label}</span>
      <input
        type="text"
        className="input input--sm"
        value={text}
        placeholder="Search customer…"
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
          if (!e.target.value.trim()) onChange(null)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
      />
      {open && debounced.trim().length >= 2 && (loading || data.length > 0) ? (
        <ul className="booking-combobox-menu" role="listbox">
          {loading ? (
            <li className="muted booking-combobox-empty">Searching…</li>
          ) : (
            data.map((hit) => (
              <li key={hit.account_id}>
                <button
                  type="button"
                  className="booking-combobox-option"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(hit)}
                >
                  <span>{hit.name}</span>
                  <span className="mono muted">{hit.account_id}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </label>
  )
}

export function customerPickerValue(
  accountId: string | null | undefined,
  name: string | null | undefined,
): CustomerPickerValue | null {
  if (!accountId) return null
  return { account_id: accountId, name: name?.trim() || accountId }
}
