import { useState } from 'react'
import { Calculator, ChevronDown, Check, NotebookPen } from 'lucide-react'
import { checkDuty, dutyNoteLine, type DutyResult } from '../dutyCheckApi'

export default function IntelDutyCheck({ onAddNote }: { onAddNote?: (line: string) => void }) {
  const [open, setOpen] = useState(false)
  const [commodity, setCommodity] = useState('')
  const [value, setValue] = useState('')
  const [origin, setOrigin] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<DutyResult | null>(null)
  const [err, setErr] = useState('')
  const [added, setAdded] = useState(false)

  async function run() {
    if (!commodity.trim() || busy) return
    setBusy(true); setErr(''); setRes(null); setAdded(false)
    try { setRes(await checkDuty({ commodity: commodity.trim(), value: Number(value) || 0, originCountry: origin.trim() })) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Duty check failed') }
    finally { setBusy(false) }
  }

  return (
    <div className="fi-sec" style={{ animationDelay: '.3s' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="fi-label"
        style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, marginBottom: open ? 8 : 0 }}>
        <Calculator size={13} /> Duty check (indicative)
        <ChevronDown size={14} style={{ marginLeft: 'auto', transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, animation: 'fi-rise .3s ease both' }}>
          <input className="input input--sm" placeholder="Commodity (e.g. cotton t-shirts)" value={commodity} onChange={(e) => setCommodity(e.target.value)} />
          <div style={{ display: 'flex', gap: 7 }}>
            <input className="input input--sm" style={{ flex: 1 }} placeholder="Value (NZD)" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
            <input className="input input--sm" style={{ flex: 1 }} placeholder="Origin country" value={origin} onChange={(e) => setOrigin(e.target.value)} />
          </div>
          <button type="button" className="btn btn--inline" onClick={run} disabled={busy || !commodity.trim()} style={{ alignSelf: 'flex-start' }}>
            {busy ? 'Checking...' : 'Check duty'}
          </button>
          {err && <span style={{ fontSize: 11.5, color: '#B23B3B' }}>{err}</span>}
          {res && (
            <div style={{ background: '#F7F9FC', border: '1px solid #e6ebf2', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#1A2233', animation: 'fi-rise .3s ease both' }}>
              <div><b>HS {res.hsCode}</b> {res.hsDescription}</div>
              <div style={{ marginTop: 4 }}>Duty {res.dutyRatePct > 0 ? `${res.dutyRatePct}% (~${res.currency} ${res.estimatedDuty.toLocaleString()})` : 'Free'} · GST {res.gstRatePct}% (~{res.currency} {res.estimatedGst.toLocaleString()})</div>
              <div style={{ marginTop: 4, fontSize: 10.5, color: '#64708a' }}>Confidence: {res.confidence}. {res.disclaimer}</div>
              {onAddNote && (
                <button type="button" className="fi-add" style={{ marginTop: 8 }} disabled={added} title="Add to quote notes" aria-label="Add to quote notes"
                  onClick={() => { onAddNote(dutyNoteLine(res)); setAdded(true) }}>
                  {added ? <Check size={14} /> : <NotebookPen size={14} />}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
