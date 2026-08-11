import { useState } from 'react'
import { X } from 'lucide-react'
import { useCustomerSearch } from '../../hooks/useBookings'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

export type VendorValue = { account_id: string; name: string } | null

type Props = {
  value: VendorValue
  onChange: (v: VendorValue) => void
  placeholder?: string
}

// Vendor = one of our customers/contacts (suppliers live in the same table).
// Reuses useCustomerSearch (open customers, name ilike, limit 8).
export default function VendorSelect({ value, onChange, placeholder }: Props) {
  const [term, setTerm] = useState('')
  const [focused, setFocused] = useState(false)
  const debounced = useDebouncedValue(term, 300)
  const { data, loading } = useCustomerSearch(debounced)

  if (value) {
    return (
      <div className="input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value.name}
          <span className="text-muted-foreground mono" style={{ fontSize: 12, marginLeft: 6 }}>· {value.account_id}</span>
        </span>
        <button
          type="button"
          aria-label="Clear vendor"
          onClick={() => { onChange(null); setTerm('') }}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 0, display: 'inline-flex' }}
        >
          <X size={15} />
        </button>
      </div>
    )
  }

  const show = focused && debounced.trim().length >= 2

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="input"
        value={term}
        placeholder={placeholder ?? 'Search customer / contact…'}
        onChange={(e) => setTerm(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 150)}
      />
      {show && (
        <ul
          role="listbox"
          style={{ position: 'absolute', zIndex: 30, top: 'calc(100% + 4px)', left: 0, right: 0, margin: 0, padding: 4, listStyle: 'none', background: '#fff', border: '1px solid var(--color-line)', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.12)', maxHeight: 260, overflow: 'auto' }}
        >
          {loading ? (
            <li className="text-muted-foreground" style={{ padding: '8px 10px', fontSize: 13 }}>Searching…</li>
          ) : data.length === 0 ? (
            <li className="text-muted-foreground" style={{ padding: '8px 10px', fontSize: 13 }}>No matches</li>
          ) : (
            data.map((c) => (
              <li key={c.account_id} role="option">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onChange({ account_id: c.account_id, name: c.name }); setFocused(false) }}
                  style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: '8px 10px', borderRadius: 6, display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14 }}
                  onMouseOver={(e) => (e.currentTarget.style.background = '#F1F5F9')}
                  onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  <span className="text-muted-foreground mono" style={{ fontSize: 12 }}>{c.account_id}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
