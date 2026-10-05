import { useEffect, useState } from 'react'
import { Handshake, Plus, ShieldCheck } from 'lucide-react'
import { supabase } from '@/supabase'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import QuickCustomerDialog from '@/components/Customers/QuickCustomerDialog'

export type OsAgentPick = { id: string; name: string; code: string | null; accountId: string | null }

type Hit = { id: string; name: string; erp_account_code: string | null; country: string | null; trusted: boolean | null }

type Props = {
  value: { id: string | null; name: string | null }
  onChange: (next: OsAgentPick | null) => void
}

/** Keep the legacy customer link only when that code is a real customer account (FK). */
async function customerAccount(code: string | null): Promise<string | null> {
  if (!code) return null
  const { data } = await supabase.from('customers').select('account_id').eq('account_id', code).maybeSingle()
  return (data as { account_id: string } | null)?.account_id ?? null
}

/** Searches the Agents directory (not customers). Not found: create a new agent inline, same dialog as Quotes. */
export default function OsAgentField({ value, onChange }: Props) {
  const [text, setText] = useState(value.name ?? '')
  const [open, setOpen] = useState(false)
  const [hits, setHits] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const debounced = useDebouncedValue(text, 250)

  useEffect(() => { setText(value.name ?? '') }, [value.id, value.name])

  useEffect(() => {
    let cancelled = false
    const q = debounced.trim()
    if (!open || q.length < 2 || q === value.name) { setHits([]); return }
    setLoading(true)
    void supabase.from('agents').select('id, name, erp_account_code, country, trusted')
      .or(`name.ilike.%${q}%,erp_account_code.ilike.%${q}%`)
      .order('trusted', { ascending: false, nullsFirst: false }).order('name').limit(10)
      .then(({ data }) => { if (!cancelled) { setHits((data ?? []) as Hit[]); setLoading(false) } })
    return () => { cancelled = true }
  }, [debounced, open, value.name])

  async function pick(h: Hit) {
    onChange({ id: h.id, name: h.name, code: h.erp_account_code, accountId: await customerAccount(h.erp_account_code) })
    setText(h.name)
    setOpen(false)
  }

  const term = text.trim()

  return (
    <label className="filter-field booking-form-field" style={{ position: 'relative' }}>
      <span className="filter-field__label">OS Agent</span>
      <input
        type="text"
        className="input input--sm"
        value={text}
        placeholder="Search agent by name or code…"
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
          if (!e.target.value.trim()) onChange(null)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
      />
      {open && term.length >= 2 && term !== value.name ? (
        <ul className="booking-combobox-menu" role="listbox">
          {loading ? <li className="muted booking-combobox-empty">Searching…</li> : null}
          {!loading && hits.length === 0 ? <li className="muted booking-combobox-empty">No agent found.</li> : null}
          {!loading && hits.map((h) => (
            <li key={h.id}>
              <button type="button" className="booking-combobox-option" onMouseDown={(e) => e.preventDefault()} onClick={() => void pick(h)}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {h.trusted ? <ShieldCheck size={12} color="#067647" aria-label="Trusted" /> : <Handshake size={12} color="#667085" />}
                  {h.name}
                </span>
                <span className="mono muted">{[h.erp_account_code, h.country].filter(Boolean).join(' · ')}</span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="booking-combobox-option" onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setCreating(true); setOpen(false) }}
              style={{ color: '#2563EB', borderTop: '1px solid #EEF2F6' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Plus size={13} /> New agent “{term}”</span>
            </button>
          </li>
        </ul>
      ) : null}
      <QuickCustomerDialog
        open={creating}
        initialName={term}
        allowAgent
        initialKind="agent"
        onClose={() => setCreating(false)}
        onCreated={(c, meta) => {
          if (meta.kind !== 'agent' || !meta.agentId) return
          const agentId = meta.agentId
          void customerAccount(c.account_id ?? null).then((accountId) => {
            onChange({ id: agentId, name: c.name, code: c.account_id ?? null, accountId })
            setText(c.name)
          })
        }}
      />
    </label>
  )
}
