import type { MarginType } from './margin'

type Props = {
  type: MarginType | '' | null
  value: string
  onChange: (type: MarginType, value: string) => void
  /** Shown when empty, e.g. the card default this line inherits. */
  placeholder?: string
  compact?: boolean
}

/** "%" or "$" (fixed per unit) switch plus a value box. Used on card headers and line grids. */
export default function MarginField({ type, value, onChange, placeholder, compact }: Props) {
  const t: MarginType = type === 'fixed' ? 'fixed' : 'pct'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'stretch', gap: 0 }}>
      <select
        className={compact ? 'input input--sm' : 'input'}
        value={t}
        onChange={(e) => onChange(e.target.value as MarginType, value)}
        title="% of cost, or a fixed amount per unit"
        aria-label="Margin type"
        style={{ width: compact ? 46 : 58, borderTopRightRadius: 0, borderBottomRightRadius: 0, paddingRight: 2 }}
      >
        <option value="pct">%</option>
        <option value="fixed">$</option>
      </select>
      <input
        className={compact ? 'input input--sm' : 'input'}
        type="number"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(t, e.target.value)}
        aria-label="Margin value"
        style={{ width: compact ? 64 : 110, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, marginLeft: -1 }}
      />
    </span>
  )
}
