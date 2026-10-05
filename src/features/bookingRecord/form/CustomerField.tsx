import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useCustomerSearch, type CustomerPickerValue } from '@/hooks/useBookings'
import QuickCustomerDialog from '@/components/Customers/QuickCustomerDialog'
import NotInCfBadge from '@/components/Customers/NotInCfBadge'

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
  const [creating, setCreating] = useState(false)
  const term = text.trim()

  useEffect(() => {
    if (value) setText(value.name)
  }, [value?.account_id, value?.name])

  function pick(hit: CustomerPickerValue) {
    onChange(hit)
    setText(hit.name)
    setOpen(false)
  }

  return (
    <label className="filter-field booking-form-field" style={{ position: 'relative' }}>
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
      {open && debounced.trim().length >= 2 && term !== value?.name ? (
        <ul className="booking-combobox-menu" role="listbox">
          {loading ? <li className="muted booking-combobox-empty">Searching…</li> : null}
          {!loading && data.length === 0 ? <li className="muted booking-combobox-empty">Not found. May not be synced from CyberFreight yet.</li> : null}
          {!loading && data.map((hit) => (
            <li key={hit.account_id}>
              <button
                type="button"
                className="booking-combobox-option"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(hit)}
              >
                <span>{hit.name}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <NotInCfBadge source={hit.source} />
                  <span className="mono muted">{hit.account_id}</span>
                </span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="booking-combobox-option" onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setCreating(true); setOpen(false) }}
              style={{ color: '#2563EB', borderTop: '1px solid #EEF2F6' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Plus size={13} /> New customer “{term}”</span>
            </button>
          </li>
        </ul>
      ) : null}
      <QuickCustomerDialog
        open={creating}
        initialName={term}
        onClose={() => setCreating(false)}
        onCreated={(c) => pick(c)}
      />
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
