import { useEffect, useRef, useState } from 'react'
import { X, Handshake } from 'lucide-react'
import { searchAgents, type AgentPick } from './agentLookupApi'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

type Props = {
  value: AgentPick | null
  onChange: (a: AgentPick | null) => void
  label?: string
}

export default function AgentPicker({ value, onChange, label = 'Agent' }: Props) {
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<AgentPick[]>([])
  const [loading, setLoading] = useState(false)
  const blur = useRef<number | undefined>(undefined)
  const debounced = useDebouncedValue(term, 250)

  useEffect(() => {
    let cancelled = false
    if (!open) return
    setLoading(true)
    ;(async () => {
      try {
        const rows = await searchAgents(debounced, 10)
        if (!cancelled) setResults(rows)
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [debounced, open])

  if (value) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)' }}>{label}</label>
        <div className="input" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 'auto', paddingTop: 8, paddingBottom: 8 }}>
          <Handshake size={15} color="#0A2472" />
          <span style={{ fontWeight: 600, fontSize: 14 }}>{value.name}</span>
          <span className="text-muted-foreground" style={{ fontSize: 12 }}>{value.erpAccountCode}{value.country ? ` · ${value.country}` : ''}</span>
          <button type="button" aria-label="Clear agent" onClick={() => onChange(null)}
            style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'inline-flex' }}>
            <X size={15} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)' }}>{label}</label>
      <input
        className="input"
        value={term}
        onChange={(e) => { setTerm(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blur.current = window.setTimeout(() => setOpen(false), 150) }}
        placeholder="Search agent by name, code or country…"
      />
      {open && (term.trim().length > 0 || results.length > 0) && (
        <div style={{ position: 'absolute', zIndex: 30, top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid var(--border, #D9DEE6)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 260, overflow: 'auto' }}>
          {loading ? (
            <div className="text-muted-foreground" style={{ padding: '8px 12px', fontSize: 13 }}>Searching…</div>
          ) : results.length === 0 ? (
            <div className="text-muted-foreground" style={{ padding: '8px 12px', fontSize: 13 }}>No agents found.</div>
          ) : (
            results.map((a) => (
              <button key={a.agentId} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(a); setTerm(''); setOpen(false) }}
                style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '8px 12px', cursor: 'pointer', fontSize: 14 }}>
                <span style={{ fontWeight: 600 }}>{a.name}</span>
                <span className="text-muted-foreground" style={{ fontSize: 12, marginLeft: 8 }}>{a.erpAccountCode}{a.country ? ` · ${a.country}` : ''}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
