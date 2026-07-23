import type { ReactNode } from 'react'

type Props = {
  label: string
  provenance?: ReactNode
  children: ReactNode
  flash?: boolean
}

export default function BookingFieldShell({ label, provenance, children, flash }: Props) {
  return (
    <label className={`filter-field booking-form-field${flash ? ' booking-field--flash' : ''}`}>
      <span className="filter-field__label booking-field-label">
        <span>{label}</span>
        {provenance}
      </span>
      {children}
    </label>
  )
}
