import type { CSSProperties } from 'react'
import MarginField from './MarginField'
import type { MarginType } from './margin'

type Props = {
  type: MarginType
  pct: number | null
  fixed: number | null
  /** Unit a fixed margin is added per, e.g. "container", "W/M", "kg". */
  unit: string
  labelStyle?: CSSProperties
  fieldStyle?: CSSProperties
  onChange: (next: { type: MarginType; pct: number | null; fixed: number | null }) => void
}

/** Card-level default margin: % of cost or a fixed amount per unit. Lines can override it. */
export default function CardDefaultMargin({ type, pct, fixed, unit, labelStyle, fieldStyle, onChange }: Props) {
  const value = type === 'fixed' ? fixed : pct
  return (
    <div style={fieldStyle}>
      <label style={labelStyle}>Default margin</label>
      <MarginField
        type={type}
        value={value == null ? '' : String(value)}
        placeholder={type === 'fixed' ? `per ${unit}` : 'e.g. 18'}
        onChange={(t, v) => {
          const n = v === '' ? null : Number(v)
          onChange(t === 'fixed' ? { type: t, pct, fixed: n } : { type: t, pct: n, fixed })
        }}
      />
      <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
        {type === 'fixed'
          ? `Sell = buy + amount per ${unit}. Set a different margin on any line to override.`
          : 'Sell = buy × (1 + %). Set a different margin on any line to override.'}
      </span>
    </div>
  )
}
