import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { StaffUser } from '../bookingRecordTypes'
import { staffDisplayName, staffInitials } from '../staffDisplayUtils'

type Props = {
  value: string | null
  staff: StaffUser[]
  onChange: (userId: string | null) => void
}

export default function StaffField({ value, staff, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selected = staff.find((s) => s.user_id === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return staff
    return staff.filter(
      (s) =>
        s.email.toLowerCase().includes(q) ||
        staffDisplayName(s.email).toLowerCase().includes(q),
    )
  }, [staff, query])

  function pick(userId: string | null) {
    onChange(userId)
    setQuery('')
    setOpen(false)
  }

  const triggerLabel = selected
    ? staffDisplayName(selected.email)
    : 'Unassigned'

  return (
    <label className="filter-field booking-form-field">
      <span className="filter-field__label">Handled by</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className="booking-staff-select"
            />
          }
        >
          {selected ? (
            <span className="import-sea-handler import-sea-handler--form">
              {staffInitials(selected.email, selected.initials)}
            </span>
          ) : (
            <span className="import-sea-handler import-sea-handler--empty import-sea-handler--form" />
          )}
          <span className="booking-staff-select__label">{triggerLabel}</span>
          <ChevronDown size={14} className="booking-staff-select__chev" />
        </PopoverTrigger>
        <PopoverContent align="start" className="booking-staff-select-menu">
          <input
            type="text"
            className="input input--sm booking-staff-select-search"
            placeholder="Search staff…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="booking-combobox-menu booking-staff-select-list" role="listbox">
            <li>
              <button
                type="button"
                className={`booking-combobox-option${!value ? ' booking-combobox-option--active' : ''}`}
                onClick={() => pick(null)}
              >
                Unassigned
              </button>
            </li>
            {filtered.map((user) => (
              <li key={user.user_id}>
                <button
                  type="button"
                  className={`booking-combobox-option${value === user.user_id ? ' booking-combobox-option--active' : ''}`}
                  onClick={() => pick(user.user_id)}
                >
                  <span className="import-sea-handler import-sea-handler--form">
                    {staffInitials(user.email, user.initials)}
                  </span>
                  <span>{staffDisplayName(user.email)}</span>
                  <span className="mono muted">{user.email}</span>
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </label>
  )
}
