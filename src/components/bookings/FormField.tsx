import type { ChangeEvent, ReactNode } from 'react'

type FieldProps = {
  label: string
  children: ReactNode
  full?: boolean
  required?: boolean
  error?: string
  showError?: boolean
  className?: string
}

export function FormField({
  label,
  children,
  full,
  required,
  error,
  showError,
  className,
}: FieldProps) {
  const hasError = showError && Boolean(error)
  return (
    <div className={`bf-field${full ? ' bf-field--full' : ''}${hasError ? ' bf-field--error' : ''}${className ? ` ${className}` : ''}`}>
      <span className="bf-field__label">
        {label}
        {required && <span className="bf-field__req"> *</span>}
      </span>
      {children}
      {hasError && error && <span className="bf-field__error">{error}</span>}
    </div>
  )
}

type TextInputProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  showError?: boolean
  error?: boolean
}

export function TextInput({ value, onChange, placeholder, showError, error }: TextInputProps) {
  return (
    <input
      className={`bf-input${showError && error ? ' bf-input--error' : ''}`}
      value={value}
      placeholder={placeholder}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
    />
  )
}

export function ToggleSwitch({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="bf-toggle">
      <span className="bf-toggle__label">{label}</span>
      <span className="bf-toggle__track">
        <input
          type="checkbox"
          className="bf-toggle__input"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="bf-toggle__thumb" aria-hidden />
      </span>
    </label>
  )
}

export function ToggleRow({
  label,
  checked,
  onChange,
  children,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  children?: ReactNode
}) {
  return (
    <div className="bf-toggle-row">
      <ToggleSwitch label={label} checked={checked} onChange={onChange} />
      <div className={`bf-toggle-row__panel${checked ? ' bf-toggle-row__panel--open' : ''}`}>
        {children}
      </div>
    </div>
  )
}
