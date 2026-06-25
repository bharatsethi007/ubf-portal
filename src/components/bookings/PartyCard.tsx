import { MapPin, Pencil, Search, User } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useCustomerSearch, type CustomerPickerValue } from '../../hooks/useBookings'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import AddressAutocomplete, { type AddressComponents } from './AddressAutocomplete'
import { FormField, TextInput } from './FormField'
import PartyOverdueBadge from './PartyOverdueBadge'
import './partyCard.css'

export type PartyValues = {
  customer: CustomerPickerValue | null
  contact: string
  phone: string
  email: string
  address: string
  city: string
  state: string
  postcode: string
  country: string
}

type Props = {
  role: string
  values: PartyValues
  onCustomerChange: (c: CustomerPickerValue | null) => void
  onChange: (patch: Partial<PartyValues>) => void
  required?: boolean
  error?: string
  showError?: boolean
  headerSlot?: ReactNode
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function PartyCard({
  role,
  values,
  onCustomerChange,
  onChange,
  required,
  error,
  showError,
  headerSlot,
}: Props) {
  const [searching, setSearching] = useState(!values.customer)
  const [editMode, setEditMode] = useState(false)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const debounced = useDebouncedValue(text, 300)
  const { data, loading } = useCustomerSearch(debounced)

  useEffect(() => {
    if (values.customer) {
      setSearching(false)
      setText('')
    }
  }, [values.customer?.account_id])

  function select(hit: CustomerPickerValue) {
    onCustomerChange(hit)
    setText('')
    setOpen(false)
    setSearching(false)
    setEditMode(false)
  }

  function startSearch() {
    setSearching(true)
    setOpen(true)
    setEditMode(false)
  }

  function changeCustomer() {
    onCustomerChange(null)
    setSearching(true)
    setOpen(true)
    setText('')
  }

  function applyAddress(address: string, c?: AddressComponents) {
    if (c) {
      onChange({
        address,
        city: c.city ?? values.city,
        state: c.state ?? values.state,
        postcode: c.postcode ?? values.postcode,
        country: c.country ?? values.country,
      })
    } else {
      onChange({ address })
    }
  }

  const q = text.trim()
  const showMenu = searching && open && q.length >= 2 && (loading || data.length > 0)
  const customer = values.customer
  const displayName = customer?.name ?? '—'

  if (!customer && searching) {
    return (
      <div className="party-card">
        {headerSlot && <div className="party-card__header-slot">{headerSlot}</div>}
        <div className="party-card__search-wrap">
          <input
            className="party-card__search-input"
            value={text}
            required={required}
            placeholder={`Search ${role.toLowerCase()}…`}
            autoFocus
            onChange={(e) => {
              setText(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          />
          {showMenu && (
            <ul className="party-card__menu" role="listbox">
              {loading ? (
                <li className="muted" style={{ padding: '8px 10px', fontSize: 12 }}>Searching…</li>
              ) : (
                data.map((hit) => (
                  <li key={hit.account_id} role="option">
                    <button type="button" className="party-card__option" onMouseDown={(e) => e.preventDefault()} onClick={() => select(hit)}>
                      <span>{hit.name}</span>
                      <span className="mono muted">{hit.account_id}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
        {showError && error && <p className="party-card__error">{error}</p>}
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="party-card">
        {headerSlot && <div className="party-card__header-slot">{headerSlot}</div>}
        <button type="button" className="party-card__empty" onClick={startSearch}>
          <Search size={18} className="party-card__empty-icon" />
          <span className="party-card__empty-label">Search {role}</span>
          <span className="party-card__empty-sub">or add new customer</span>
        </button>
        {showError && error && <p className="party-card__error">{error}</p>}
      </div>
    )
  }

  return (
    <div className="party-card">
      <div className="party-card__solid">
        <div className="party-card__header">
          <span className="party-card__badge">{initials(displayName)}</span>
          <div className="party-card__meta">
            <div className="party-card__name-row">
              <div className="party-card__name">{displayName}</div>
              <PartyOverdueBadge accountId={customer.account_id} />
            </div>
            <div className="party-card__role-line">
              {role.toUpperCase()} · <span className="mono">{customer.account_id}</span>
            </div>
          </div>
          {headerSlot && <div className="party-card__header-slot party-card__header-slot--inline">{headerSlot}</div>}
          <button type="button" className="party-card__edit-btn" onClick={() => setEditMode((v) => !v)} aria-label="Edit contact details">
            <Pencil size={14} />
          </button>
        </div>

        {!editMode ? (
          <div className="party-card__body">
            <div className="party-card__line">
              <MapPin size={13} />
              <span>{values.address.trim() || '—'}</span>
            </div>
            <div className="party-card__line">
              <User size={13} />
              <span>
                {[values.contact.trim() || null, values.phone.trim() || null].filter(Boolean).join(' · ') || '—'}
              </span>
            </div>
          </div>
        ) : (
          <div className="party-card__edit">
            <div className="party-card__edit-grid">
              <FormField label="Contact">
                <TextInput value={values.contact} onChange={(v) => onChange({ contact: v })} />
              </FormField>
              <FormField label="Phone">
                <TextInput value={values.phone} onChange={(v) => onChange({ phone: v })} />
              </FormField>
              <FormField label="Email" className="bf-field--full">
                <TextInput value={values.email} onChange={(v) => onChange({ email: v })} />
              </FormField>
              <FormField label="Address" className="bf-field--full">
                <AddressAutocomplete
                  label=""
                  value={values.address}
                  onChange={applyAddress}
                  usePlaces={!values.address.trim()}
                />
              </FormField>
            </div>
            <div className="party-card__edit-actions">
              <button type="button" className="party-card__change" onClick={changeCustomer}>Change</button>
              <button type="button" className="party-card__done" onClick={() => setEditMode(false)}>Done</button>
            </div>
          </div>
        )}
      </div>
      {showError && error && <p className="party-card__error">{error}</p>}
    </div>
  )
}
