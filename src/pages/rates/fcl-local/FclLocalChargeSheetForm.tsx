import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { createLocalChargeSheet } from './localChargesApi'

type Direction = 'origin' | 'dest'
type Movement = 'import' | 'export'

const fieldStyle = { display: 'flex', flexDirection: 'column' as const, gap: 6 }
const labelStyle = { fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)' }

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'inline-flex', gap: 6 }}>
      {options.map((o) => {
        const on = value === o.v
        return (
          <button key={o.v} type="button" onClick={() => onChange(o.v)}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer',
              border: on ? '1px solid #0A2472' : '1px solid var(--border, #D9DEE6)',
              background: on ? '#0A2472' : 'transparent', color: on ? '#fff' : 'var(--foreground, #1A2233)',
            }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export default function FclLocalChargeSheetForm() {
  const navigate = useNavigate()
  const [direction, setDirection] = useState<Direction>('dest')
  const [movement, setMovement] = useState<Movement>('import')
  const [title, setTitle] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const datesOk = validFrom !== '' && validTo !== '' && validFrom <= validTo
  const valid = datesOk

  async function onSubmit() {
    if (!valid || saving) return
    setSaving(true)
    setError('')
    try {
      await createLocalChargeSheet({ direction, movement, title: title.trim(), valid_from: validFrom, valid_to: validTo })
      navigate('/setup/rates/fcl-local')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create sheet')
      setSaving(false)
    }
  }

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <header className="quotes-page__head">
          <Link to="/setup/rates/fcl-local" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted-foreground)', textDecoration: 'none', marginBottom: 8 }}>
            <ArrowLeft size={15} /> Sea FCL Local / Port Charges
          </Link>
          <h1>New local charge sheet</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted-foreground)', fontSize: 14 }}>
            Set the sheet identity. You&apos;ll add ports, shipping lines, and charge lines next.
          </p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 16, maxWidth: 720 }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Direction *</label>
            <Segmented<Direction> value={direction} onChange={setDirection}
              options={[{ v: 'origin', label: 'Origin' }, { v: 'dest', label: 'Destination' }]} />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Movement *</label>
            <Segmented<Movement> value={movement} onChange={setMovement}
              options={[{ v: 'import', label: 'Import' }, { v: 'export', label: 'Export' }]} />
          </div>

          <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Auckland — Import Destination Charges" />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Valid from *</label>
            <input type="date" className="input" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Valid to *</label>
            <input type="date" className="input" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
          </div>
        </div>

        {validFrom !== '' && validTo !== '' && validFrom > validTo && (
          <p style={{ color: '#B23B3B', fontSize: 13, marginTop: 10 }}>Valid-to must be on or after valid-from.</p>
        )}
        {error && <p style={{ color: '#B23B3B', fontSize: 13, marginTop: 10 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, alignItems: 'center' }}>
          <button type="button" className="btn btn--inline" onClick={onSubmit} disabled={!valid || saving} style={{ opacity: !valid || saving ? 0.5 : 1 }}>
            {saving ? 'Creating…' : 'Create sheet'}
          </button>
          <Link to="/setup/rates/fcl-local" style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 14px', fontSize: 14, color: 'var(--muted-foreground)', textDecoration: 'none' }}>Cancel</Link>
        </div>
      </div>
    </div>
  )
}
