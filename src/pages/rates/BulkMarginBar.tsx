import { useEffect, useRef, useState } from 'react'
import { Check, RotateCcw, Search, X } from 'lucide-react'
import MarginField from './MarginField'
import type { MarginType } from './margin'

type BarProps = {
  total: number
  shown: number
  selectedCount: number
  filter: string
  onFilter: (v: string) => void
  /** Apply this margin to every selected line. */
  onApply: (type: MarginType, value: number) => void
  /** Clear the override on selected lines so they use the card default again. */
  onReset: () => void
  onClearSelection: () => void
  unit: string
}

/** Filter + bulk margin bar shown above a rate-card line grid. */
export function BulkMarginBar({ total, shown, selectedCount, filter, onFilter, onApply, onReset, onClearSelection, unit }: BarProps) {
  const [type, setType] = useState<MarginType>('fixed')
  const [value, setValue] = useState('')
  const n = Number(value)
  const canApply = selectedCount > 0 && value.trim() !== '' && Number.isFinite(n)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border, #D9DEE6)', borderRadius: 8, padding: '0 8px', height: 32, background: '#fff' }}>
        <Search size={14} color="#94A3B8" />
        <input
          value={filter}
          onChange={(e) => onFilter(e.target.value)}
          placeholder="Filter lines (port, container…)"
          style={{ border: 0, outline: 'none', fontSize: 13, width: 200, background: 'transparent' }}
        />
        {filter && (
          <button type="button" onClick={() => onFilter('')} aria-label="Clear filter" title="Clear filter"
            style={{ border: 0, background: 'transparent', cursor: 'pointer', display: 'inline-flex', color: '#94A3B8' }}>
            <X size={14} />
          </button>
        )}
      </span>
      {filter && <span className="text-muted-foreground" style={{ fontSize: 12 }}>{shown} of {total} shown</span>}

      {selectedCount > 0 && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 'auto', padding: '4px 8px', borderRadius: 8, background: '#EFF4FF', border: '1px solid #C7D7FE' }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#0A2472' }}>{selectedCount} selected</span>
          <MarginField compact type={type} value={value} placeholder={type === 'fixed' ? `per ${unit}` : '%'}
            onChange={(t, v) => { setType(t); setValue(v) }} />
          <button type="button" className="btn btn--inline" disabled={!canApply} onClick={() => onApply(type, n)}
            title="Apply margin to selected lines" aria-label="Apply margin to selected lines"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 'auto', padding: '6px 10px' }}>
            <Check size={15} />
          </button>
          <button type="button" className="icon-btn" onClick={onReset}
            title="Reset selected lines to the card default" aria-label="Reset selected lines to the card default">
            <RotateCcw size={14} />
          </button>
          <button type="button" className="icon-btn" onClick={onClearSelection} title="Clear selection" aria-label="Clear selection">
            <X size={14} />
          </button>
        </span>
      )}
    </div>
  )
}

/** Header checkbox with the indeterminate (some selected) state. */
export function SelectAllBox({ all, some, onToggle }: { all: boolean; some: boolean; onToggle: () => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = some }, [some])
  return <input ref={ref} type="checkbox" checked={all} onChange={onToggle} aria-label="Select all shown lines" />
}

/** Row checkbox; shift-click selects a range. */
export function RowBox({ checked, onToggle }: { checked: boolean; onToggle: (shift: boolean) => void }) {
  return (
    <input type="checkbox" checked={checked} aria-label="Select line"
      onChange={() => { /* handled on click for shift support */ }}
      onClick={(e) => onToggle(e.shiftKey)} />
  )
}
