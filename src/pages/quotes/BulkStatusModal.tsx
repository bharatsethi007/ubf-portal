import { useState, type CSSProperties } from 'react'
import { STATUS_OPTIONS } from './quotesTableColumns'

type Props = {
  open: boolean
  count: number
  busy?: boolean
  onClose: () => void
  onApply: (from: string, to: string) => void
}

export default function BulkStatusModal({ open, count, busy = false, onClose, onApply }: Props) {
  const [from, setFrom] = useState('any')
  const [to, setTo] = useState('open')
  if (!open) return null
  return (
    <div style={overlay} onClick={onClose}>
      <div style={sheet} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#0A2472' }}>Change status</h3>
        <p style={{ margin: '0 0 18px', color: '#64748b', fontSize: 13 }}>
          {count} quote{count !== 1 ? 's' : ''} selected
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <label style={col}>
            <span style={lbl}>Change from</span>
            <select style={inp} value={from} onChange={(e) => setFrom(e.target.value)}>
              <option value="any">Any status</option>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <span style={{ paddingBottom: 8, color: '#94a3b8', fontSize: 18 }}>→</span>
          <label style={col}>
            <span style={lbl}>New status</span>
            <select style={inp} value={to} onChange={(e) => setTo(e.target.value)}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
          <button style={btnGhost} onClick={onClose} disabled={busy}>Cancel</button>
          <button style={btnPrimary} onClick={() => onApply(from, to)} disabled={busy}>
            {busy ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  )
}

const overlay: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
}
const sheet: CSSProperties = {
  background: '#fff', borderRadius: 12, padding: 24, width: 'min(440px, 92vw)',
  boxShadow: '0 20px 50px rgba(15,23,42,0.25)',
}
const col: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }
const lbl: CSSProperties = { fontSize: 12, color: '#475569' }
const inp: CSSProperties = {
  height: 38, borderRadius: 8, border: '1px solid #cbd5e1', padding: '0 10px', fontSize: 14, background: '#fff',
}
const btnGhost: CSSProperties = {
  height: 38, padding: '0 16px', borderRadius: 8, border: '1px solid #cbd5e1',
  background: '#fff', color: '#334155', fontSize: 14, cursor: 'pointer',
}
const btnPrimary: CSSProperties = {
  height: 38, padding: '0 18px', borderRadius: 8, border: 'none',
  background: '#0A2472', color: '#fff', fontSize: 14, cursor: 'pointer',
}
