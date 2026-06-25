import type { ChangeEvent, ReactNode } from 'react'

type FieldProps = { label: string; children: ReactNode; full?: boolean }

export function FormField({ label, children, full }: FieldProps) {
  return (
    <div className={`booking-form__field${full ? ' booking-form__field--full' : ''}`}>
      <span className="booking-form__label">{label}</span>
      {children}
    </div>
  )
}

type TextInputProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function TextInput({ value, onChange, placeholder }: TextInputProps) {
  return (
    <input
      className="input input--sm"
      value={value}
      placeholder={placeholder}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
    />
  )
}

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="booking-form__section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}
