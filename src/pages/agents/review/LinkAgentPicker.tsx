import { useEffect, useMemo, useRef, useState } from 'react'
import { Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AgentOption } from './reviewApi'

type Props = {
  agents: AgentOption[]
  busy: boolean
  onPick: (agent: AgentOption) => void
}

const panel: React.CSSProperties = {
  position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 50, width: 300, padding: 8,
  background: 'var(--paper, #fff)', border: '1px solid var(--line, var(--border))', borderRadius: 10,
  boxShadow: '0 8px 24px rgba(16,24,40,.12)',
}
const item: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', width: '100%', padding: '6px 8px', border: 'none', borderRadius: 6,
  background: 'transparent', textAlign: 'left', cursor: 'pointer', fontSize: 13, fontWeight: 400,
}

// "Link to…" — attach this code to an agent that already exists (same agent, another company's account).
export default function LinkAgentPicker({ agents, busy, onPick }: Props) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const hits = useMemo(() => {
    const t = term.trim().toLowerCase()
    if (t.length < 2) return []
    return agents.filter((a) => a.name.toLowerCase().includes(t) || (a.code ?? '').toLowerCase().includes(t)).slice(0, 12)
  }, [agents, term])

  return (
    <div ref={ref} style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setOpen((v) => !v)}
        title="Same agent as one we already have">
        <Link2 size={14} />
        Link to…
      </Button>
      {open ? (
        <div style={panel}>
          <input autoFocus className="input input--sm" style={{ width: '100%' }} placeholder="Search agents"
            value={term} onChange={(e) => setTerm(e.target.value)} />
          <div style={{ maxHeight: 260, overflowY: 'auto', marginTop: 6 }}>
            {term.trim().length < 2 ? (
              <p className="text-muted-foreground" style={{ fontSize: 12, padding: '4px 8px' }}>Type 2+ letters</p>
            ) : hits.length === 0 ? (
              <p className="text-muted-foreground" style={{ fontSize: 12, padding: '4px 8px' }}>No agent found</p>
            ) : hits.map((a) => (
              <button key={a.id} type="button" style={item}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                onClick={() => { setOpen(false); setTerm(''); onPick(a) }}>
                <span>{a.name}</span>
                <span className="text-muted-foreground" style={{ fontSize: 11 }}>
                  {[a.code ? `#${a.code}` : null, a.country].filter(Boolean).join(' · ')}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
