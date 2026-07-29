type Option = { value: string; label: string }

type Props = {
  value: string | null
  onChange: (value: string | null) => void
  options: Option[]
  placeholder?: string
  disabled?: boolean
  className?: string
  allowEmpty?: boolean
}

export default function RefSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled,
  className,
  allowEmpty = true,
}: Props) {
  return (
    <select
      className={className ?? 'input input--sm'}
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
    >
      {allowEmpty && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
