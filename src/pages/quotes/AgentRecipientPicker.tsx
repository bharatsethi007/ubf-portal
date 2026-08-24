import { useEffect, useState } from 'react'
import { toast } from 'sonner'
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

  const chip = (t: string, bg: string, color: string) => (
    <span style={{ background: bg, color, borderRadius: 999, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>{t}</span>
  )
  const tabBtn = (m: 'agents' | 'extended', label: string) => (
    <button className="btn" onClick={() => setMode(m)}
      style={{ padding: '5px 12px', fontSize: 13, background: mode === m ? '#0A2472' : 'transparent', color: mode === m ? '#fff' : 'var(--muted-foreground)' }}>{label}</button>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,17,40,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, maxWidth: 560, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '16px 18px 8px' }}>
          <h3 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 600, color: '#0A2472' }}>Add recipients</h3>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--muted-foreground)' }}>
            Agent at {agentEnd === 'origin' ? 'origin' : 'destination'}{agentCountry ? ` · ${agentCountry}` : ''}
          </p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>{tabBtn('agents', 'Our agents')}{tabBtn('extended', 'Extended (all customers)')}</div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 10, fontSize: 12 }}>
            {agentCountry && (
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={onlyCountry} onChange={(e) => setOnlyCountry(e.target.checked)} /> Only {agentCountry}
              </label>
            )}
            {mode === 'agents' && (
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={trustedOnly} onChange={(e) => setTrustedOnly(e.target.checked)} /> Trusted only
              </label>
            )}
          </div>
          <input className="input" placeholder={mode === 'agents' ? 'Search agents by name…' : 'Search customers by name / email / code…'} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div style={{ overflowY: 'auto', padding: '0 18px', flex: 1 }}>
          {loading && <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Searching…</p>}

          {!loading && mode === 'agents' && agents.length === 0 && (
            <p style={{ fontSize: 12, color: '#B4791F' }}>
              No agents{onlyCountry && agentCountry ? ` in ${agentCountry}` : ''}. Try Extended (all customers) or add a recipient manually below.
            </p>
          )}
          {!loading && mode === 'agents' && agents.map((a) => {
            const disabled = !a.email
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #F0F1F5' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</span>
                    {a.trusted && chip('Trusted', '#FCEFD6', '#B4791F')}
                    {a.country && chip(a.country, '#EEF1FB', '#0A2472')}
                  </div>
                  <div style={{ fontSize: 11, color: disabled ? '#B23B3B' : 'var(--muted-foreground)' }}>{a.email ?? 'No email on file — add manually below'}</div>
                </div>
                <button className="btn" disabled={disabled} onClick={() => add({ key: crypto.randomUUID(), source: 'agent', agentId: a.id, accountId: null, name: a.contactName || a.name, email: a.email! })}
                  style={{ padding: '4px 12px', fontSize: 12, opacity: disabled ? 0.4 : 1 }}>Add</button>
              </div>
            )
          })}

          {!loading && mode === 'extended' && customers.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>No customers match. Add a recipient manually below.</p>
          )}
          {!loading && mode === 'extended' && customers.map((c) => {
            const disabled = !c.email
            return (
              <div key={c.accountId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #F0F1F5' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</span>
                    {c.country && chip(c.country, '#EEF1FB', '#0A2472')}
                    {chip(c.accountId, '#F0F1F5', '#555')}
                  </div>
                  <div style={{ fontSize: 11, color: disabled ? '#B23B3B' : 'var(--muted-foreground)' }}>{c.email ?? 'No email on file — add manually below'}</div>
                </div>
                <button className="btn" disabled={disabled} onClick={() => add({ key: crypto.randomUUID(), source: 'customer', agentId: null, accountId: c.accountId, name: c.contactName || c.name, email: c.email! })}
                  style={{ padding: '4px 12px', fontSize: 12, opacity: disabled ? 0.4 : 1 }}>Add</button>
              </div>
            )
          })}
        </div>

        <div style={{ padding: '10px 18px 16px', borderTop: '1px solid #F0F1F5' }}>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 6 }}>Add manually</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="input" placeholder="Name (optional)" value={mName} onChange={(e) => setMName(e.target.value)} style={{ flex: '1 1 140px' }} />
            <input className="input" placeholder="email@example.com" value={mEmail} onChange={(e) => setMEmail(e.target.value)} style={{ flex: '1 1 180px' }} />
            <button className="btn" onClick={addManual} style={{ background: '#0A2472', color: '#fff', padding: '6px 14px' }}>Add</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn" onClick={onClose} style={{ padding: '6px 16px' }}>Done</button>
          </div>
        </div>
      </div>
    </div>
  )
}
