import { useEffect, useRef, useState } from 'react'
import { X, Handshake } from 'lucide-react'
import { searchParties, type Party } from './partySearchApi'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

// Small "Direct / Agent" left-right switch shown next to a selected party.
function AgentSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label="Agent enquiry" onClick={() => onChange(!on)}
      title={on ? 'Agent enquiry — on' : 'Agent enquiry — off'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: on ? '#0A2472' : 'var(--muted-foreground)' }}>Agent</span>
      <span style={{ width: 34, height: 20, borderRadius: 999, background: on ? '#0A2472' : '#CBD3DE', position: 'relative', transition: 'background .15s' }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
      </span>
    </button>
  )
}

const badge = {
  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700,
  color: '#0A2472', background: '#E7EEFF', border: '1px solid #c7d2fe', borderRadius: 999, padding: '1px 7px',
} as const

type Props = {
  value: Party | null
  agentMode: boolean
  onSelect: (p: Party | null) => void
  onToggleAgent: (on: boolean) => void
  label?: string
}

export default function PartySearch({ value, agentMode, onSelect, onToggleAgent, label = 'Customer / Agent' }: Props) {
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Party[]>([])
  const [loading, setLoading] = useState(false)
  const blur = useRef<number | undefined>(undefined)
  const debounced = useDebouncedValue(term, 250)

  useEffect(() => {
    let cancelled = false
    if (!open || debounced.trim().length < 2) { setRows([]); return }
    setLoading(true)
    ;(async () => {
      try { const r = await searchParties(debounced, 8); if (!cancelled) setRows(r) }
      catch { if (!cancelled) setRows([]) }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [debounced, open])

  if (value) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)' }}>{label}</label>
        <div className="input" style={{ display: 'flex', alignItems: 'center', gap: 10, height: 'auto', paddingTop: 8, paddingBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{value.name}</span>
          <span className="text-muted-foreground" style={{ fontSize: 12 }}>{value.account_id}</span>
          {value.isAgent && <span style={badge}><Handshake size={11} /> Agent</span>}
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            <AgentSwitch on={agentMode} onChange={onToggleAgent} />
            <button type="button" aria-label="Clear" onClick={() => onSelect(null)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'inline-flex' }}>
              <X size={15} />
            </button>
          </span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)' }}>{label} <span className="text-muted-foreground" style={{ fontWeight: 400 }}>(optional)</span></label>
      <input className="input" value={term} onChange={(e) => { setTerm(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)}
        onBlur={() => { blur.current = window.setTimeout(() => setOpen(false), 150) }}
        placeholder="Search customer or agent by name or code…" />
      {open && debounced.trim().length >= 2 && (
        <div style={{ position: 'absolute', zIndex: 30, top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid var(--border, #D9DEE6)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 300, overflow: 'auto' }}>
          {loading ? (
            <div className="text-muted-foreground" style={{ padding: '8px 12px', fontSize: 13 }}>Searching…</div>
          ) : rows.length === 0 ? (
            <div className="text-muted-foreground" style={{ padding: '8px 12px', fontSize: 13 }}>No matches.</div>
          ) : (
            rows.map((p) => (
              <button key={`${p.account_id}-${p.agentId ?? ''}`} type="button" onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onSelect(p); setTerm(''); setOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '8px 12px', cursor: 'pointer', fontSize: 14 }}>
                <span style={{ fontWeight: 600 }}>{p.name}</span>
                <span className="text-muted-foreground" style={{ fontSize: 12 }}>{p.account_id}{p.country ? ` · ${p.country}` : ''}</span>
                {p.isAgent && <span style={{ ...badge, marginLeft: 'auto' }}><Handshake size={11} /> Agent</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
