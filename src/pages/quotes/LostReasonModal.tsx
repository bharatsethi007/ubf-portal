import { useEffect, useState, type CSSProperties } from 'react'
import { LOST_REASONS, type LostInfo } from './quoteLostReasons'

type Props = {
  open: boolean
  count?: number
  busy?: boolean
  onClose: () => void
  onConfirm: (info: LostInfo) => void
}

export default function LostReasonModal({ open, count = 1, busy = false, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => { if (open) { setReason(''); setNote('') } }, [open])
  if (!open) return null

  const needNote = reason === 'Other'
  const ok = !!reason && (!needNote || note.trim().length > 0)

  return (
    <div style={overlay} onClick={onClose}>
      <div style={sheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Mark lost">
        <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#0A2472', fontWeight: 500 }}>Mark lost</h3>
        <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 13 }}>
          {count > 1 ? `${count} quotes` : 'This quote'} will move to Lost.
        </p>
        <label style={col}>
          <span style={lbl}>Reason</span>
          <select style={inp} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus>
            <option value="">Select a reason</option>
            {LOST_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label style={{ ...col, marginTop: 12 }}>
          <span style={lbl}>Note {needNote ? '' : '(optional)'}</span>
          <textarea
            style={{ ...inp, height: 64, padding: '8px 10px', resize: 'vertical' }}
            value={note}
            placeholder={needNote ? 'Tell us why' : 'e.g. competitor name or their rate'}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button type="button" style={btnGhost} onClick={onClose} disabled={busy}>Cancel</button>
          <button
            type="button"
            style={{ ...btnPrimary, opacity: ok && !busy ? 1 : 0.5 }}
            disabled={!ok || busy}
            onClick={() => onConfirm({ reason, note: note.trim() || null })}
          >
            {busy ? 'Saving…' : 'Mark lost'}
          </button>
        </div>
      </div>
    </div>
  )
}

const overlay: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
}
const sheet: CSSProperties = {
  background: '#fff', borderRadius: 12, padding: 24, width: 'min(420px, 92vw)',
  boxShadow: '0 20px 50px rgba(15,23,42,0.25)',
}
const col: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 }
const lbl: CSSProperties = { fontSize: 12, color: '#475569' }
const inp: CSSProperties = {
  height: 38, borderRadius: 8, border: '1px solid #cbd5e1', padding: '0 10px', fontSize: 14, background: '#fff', width: '100%',
}
const btnGhost: CSSProperties = {
  height: 38, padding: '0 16px', borderRadius: 8, border: '1px solid #cbd5e1',
  background: '#fff', color: '#334155', fontSize: 14, cursor: 'pointer',
}
const btnPrimary: CSSProperties = {
  height: 38, padding: '0 18px', borderRadius: 8, border: 'none',
  background: '#B91C1C', color: '#fff', fontSize: 14, cursor: 'pointer',
}
