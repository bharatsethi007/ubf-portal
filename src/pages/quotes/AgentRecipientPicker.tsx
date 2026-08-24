import { useEffect, useState, type CSSProperties } from 'react'
import { toast } from 'sonner'
import { BadgeCheck } from 'lucide-react'
import {
  searchAgentDirectory, searchCustomers,
  type Recipient, type DirectoryAgent, type DirectoryCustomer,
} from './rateRequestApi'

type Props = {
  agentCountry: string | null
  agentEnd: 'origin' | 'dest' | null
  existing: Recipient[]
  onAdd: (r: Recipient) => void
  onClose: () => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ghost: CSSProperties = { marginTop: 0, width: 'auto', height: 28, padding: '0 12px', fontSize: 12 }
const label: CSSProperties = { fontSize: 12, color: 'var(--muted-foreground)' }
const metaPill: CSSProperties = { background: '#EEF4FF', color: '#0A2472', border: '1px solid rgba(10,36,114,.08)', borderRadius: 999, padding: '1px 7px', fontSize: 10, fontWeight: 500 }
const mutedPill: CSSProperties = { background: '#F2F4F7', color: '#667085', borderRadius: 999, padding: '1px 7px', fontSize: 10, fontWeight: 500 }

export default function AgentRecipientPicker({ agentCountry, agentEnd, existing, onAdd, onClose }: Props) {
  const [mode, setMode] = useState<'agents' | 'extended'>('agents')
  const [trustedOnly, setTrustedOnly] = useState(false)
  const [onlyCountry, setOnlyCountry] = useState(!!agentCountry)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [agents, setAgents] = useState<DirectoryAgent[]>([])
  const [customers, setCustomers] = useState<DirectoryCustomer[]>([])
  const [loading, setLoading] = useState(false)
  const [mName, setMName] = useState('')
  const [mEmail, setMEmail] = useState('')

  useEffect(() => { const t = setTimeout(() => setDebounced(query), 250); return () => clearTimeout(t) }, [query])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        if (mode === 'agents') {
          const rows = await searchAgentDirectory({ country: onlyCountry ? agentCountry : null, trustedOnly, query: debounced })
          if (!cancelled) setAgents(rows)
        } else {
          const rows = await searchCustomers(debounced, onlyCountry ? agentCountry : null)
          if (!cancelled) setCustomers(rows)
        }
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Search failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [mode, trustedOnly, onlyCountry, debounced, agentCountry])

  const has = (email: string | null) => !!email && existing.some((r) => r.email.toLowerCase() === email.toLowerCase())

  function add(r: Recipient) {
    if (has(r.email)) { toast('Already added'); return }
    onAdd(r); toast.success(`Added ${r.email}`)
  }

  function addManual() {
    const email = mEmail.trim()
    if (!EMAIL_RE.test(email)) { toast.error('Enter a valid email'); return }
    if (has(email)) { toast('Already added'); return }
    onAdd({ key: crypto.randomUUID(), source: 'manual', agentId: null, accountId: null, name: mName.trim() || null, email })
    setMName(''); setMEmail(''); toast.success(`Added ${email}`)
  }

  const tabBtn = (m: 'agents' | 'extended', text: string) => (
    <button onClick={() => setMode(m)} style={{
      border: 'none', background: mode === m ? '#EEF4FF' : 'transparent', color: mode === m ? '#0A2472' : 'var(--muted-foreground)',
      padding: '5px 12px', fontSize: 13, fontWeight: 500, borderRadius: 6, cursor: 'pointer',
    }}>{text}</button>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 10, maxWidth: 560, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 40px rgba(16,24,40,0.16)' }}>
        <div style={{ padding: '16px 18px 10px' }}>
          <div style={{ fontSize: 14, color: '#0A2472', fontWeight: 500, marginBottom: 2 }}>Add recipients</div>
          <p style={{ ...label, margin: '0 0 12px' }}>Agent at {agentEnd === 'origin' ? 'origin' : 'destination'}{agentCountry ? ` · ${agentCountry}` : ''}</p>
          <div style={{ display: 'inline-flex', gap: 2, marginBottom: 10, border: '1px solid #E4E7EC', borderRadius: 8, padding: 2 }}>
            {tabBtn('agents', 'Our agents')}{tabBtn('extended', 'Extended (all customers)')}
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 10 }}>
            {agentCountry && (
              <label style={{ ...label, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={onlyCountry} onChange={(e) => setOnlyCountry(e.target.checked)} /> Only {agentCountry}
              </label>
            )}
            {mode === 'agents' && (
              <label style={{ ...label, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={trustedOnly} onChange={(e) => setTrustedOnly(e.target.checked)} /> Trusted only
              </label>
            )}
          </div>
          <input className="input" placeholder={mode === 'agents' ? 'Search agents by name…' : 'Search customers by name / email / code…'} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div style={{ overflowY: 'auto', padding: '0 18px', flex: 1 }}>
          {loading && <p style={label}>Searching…</p>}

          {!loading && mode === 'agents' && agents.length === 0 && (
            <p style={{ ...label, color: '#B4791F' }}>No agents{onlyCountry && agentCountry ? ` in ${agentCountry}` : ''}. Try Extended (all customers) or add a recipient manually below.</p>
          )}
          {!loading && mode === 'agents' && agents.map((a) => {
            const disabled = !a.email
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #F2F4F7' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</span>
                    {a.trusted && (
                      <span title="Trusted" style={{ display: 'inline-flex' }}>
                        <BadgeCheck size={15} color="#0A2472" />
                      </span>
                    )}
                    {a.country && <span style={metaPill}>{a.country}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: disabled ? '#B42318' : 'var(--muted-foreground)' }}>{a.email ?? 'No email on file — add manually below'}</div>
                </div>
                <button className="btn btn--ghost btn--inline" disabled={disabled} style={ghost}
                  onClick={() => add({ key: crypto.randomUUID(), source: 'agent', agentId: a.id, accountId: null, name: a.contactName || a.name, email: a.email! })}>Add</button>
              </div>
            )
          })}

          {!loading && mode === 'extended' && customers.length === 0 && (
            <p style={label}>No customers match. Add a recipient manually below.</p>
          )}
          {!loading && mode === 'extended' && customers.map((c) => {
            const disabled = !c.email
            return (
              <div key={c.accountId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #F2F4F7' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</span>
                    {c.country && <span style={metaPill}>{c.country}</span>}
                    <span style={mutedPill}>{c.accountId}</span>
                  </div>
                  <div style={{ fontSize: 11, color: disabled ? '#B42318' : 'var(--muted-foreground)' }}>{c.email ?? 'No email on file — add manually below'}</div>
                </div>
                <button className="btn btn--ghost btn--inline" disabled={disabled} style={ghost}
                  onClick={() => add({ key: crypto.randomUUID(), source: 'customer', agentId: null, accountId: c.accountId, name: c.contactName || c.name, email: c.email! })}>Add</button>
              </div>
            )
          })}
        </div>

        <div style={{ padding: '12px 18px 16px', borderTop: '1px solid #F2F4F7' }}>
          <div style={{ ...label, marginBottom: 6 }}>Add manually</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="input" placeholder="Name (optional)" value={mName} onChange={(e) => setMName(e.target.value)} style={{ flex: '1 1 140px' }} />
            <input className="input" placeholder="email@example.com" value={mEmail} onChange={(e) => setMEmail(e.target.value)} style={{ flex: '1 1 180px' }} />
            <button className="btn btn--ghost btn--inline" onClick={addManual} style={ghost}>Add</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn btn--ghost btn--inline" onClick={onClose} style={ghost}>Done</button>
          </div>
        </div>
      </div>
    </div>
  )
}
