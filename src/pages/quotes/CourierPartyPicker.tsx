import { useEffect, useState } from 'react'
import { Handshake } from 'lucide-react'
import { supabase } from '../../supabase'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import './courierPartyPicker.css'

export type CourierPartyPick = {
  name: string
  company: string
  countryCode: string
  address1?: string
  address2?: string
  address3?: string
  city?: string
  postcode?: string
  state?: string
  email?: string
  phone?: string
}

const COUNTRY_TO_CODE: Record<string, string> = {
  'new zealand': 'NZ',
  australia: 'AU',
  china: 'CN',
  fiji: 'FJ',
  'united states': 'US',
  usa: 'US',
  'united kingdom': 'GB',
  uk: 'GB',
  japan: 'JP',
  'south korea': 'KR',
  singapore: 'SG',
  'hong kong': 'HK',
}

function toCountryCode(country?: string | null): string {
  const t = (country ?? '').trim()
  if (!t) return ''
  if (/^[a-zA-Z]{2}$/.test(t)) return t.toUpperCase()
  return COUNTRY_TO_CODE[t.toLowerCase()] ?? ''
}

function str(v: unknown): string | undefined {
  if (v == null || v === '') return undefined
  return String(v)
}

function hasAddress(p: Pick<CourierPartyPick, 'address1' | 'address2' | 'address3' | 'city' | 'postcode'>): boolean {
  return !!(p.address1?.trim() || p.address2?.trim() || p.address3?.trim() || p.city?.trim() || p.postcode?.trim())
}

function customerToPick(r: Record<string, unknown>): CourierPartyPick {
  const name = String(r.name ?? '')
  return {
    name,
    company: name,
    countryCode: toCountryCode(str(r.country)),
    address1: str(r.address1),
    address2: str(r.address2),
    address3: str(r.address3),
    city: str(r.city),
    postcode: str(r.postcode),
    state: str(r.state),
    email: str(r.email),
    phone: str(r.phone),
  }
}

type Hit = { key: string; label: string; meta: string; isAgent: boolean; pick: () => Promise<CourierPartyPick> }

async function searchCustomers(q: string): Promise<Hit[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('account_id,name,address1,address2,address3,city,postcode,state,country,email,phone')
    .ilike('name', `%${q}%`)
    .limit(8)
  if (error) throw error
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>
    const accountId = String(row.account_id ?? '')
    return {
      key: accountId,
      label: String(row.name ?? ''),
      meta: accountId,
      isAgent: false,
      pick: async () => customerToPick(row),
    }
  })
}

async function searchAgents(q: string): Promise<Hit[]> {
  const { data, error } = await supabase
    .from('agents')
    .select('id,name,country,erp_account_code')
    .ilike('name', `%${q}%`)
    .limit(8)
  if (error) throw error
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>
    const id = String(row.id ?? '')
    const erp = String(row.erp_account_code ?? '')
    const name = String(row.name ?? erp)
    return {
      key: id,
      label: name,
      meta: erp || id,
      isAgent: true,
      pick: async () => {
        const [custRes, contactRes] = await Promise.all([
          erp
            ? supabase.from('customers').select('name,address1,address2,address3,city,postcode,state,country,email,phone').eq('account_id', erp).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          supabase.from('agent_contacts').select('email,phone').eq('agent_id', id).eq('is_prime', true).maybeSingle(),
        ])
        if (custRes.error) throw custRes.error
        if (contactRes.error) throw contactRes.error
        const cust = (custRes.data ?? {}) as Record<string, unknown>
        const contact = (contactRes.data ?? {}) as Record<string, unknown>
        return {
          name,
          company: name,
          countryCode: toCountryCode(str(cust.country) ?? str(row.country)),
          address1: str(cust.address1),
          address2: str(cust.address2),
          address3: str(cust.address3),
          city: str(cust.city),
          postcode: str(cust.postcode),
          state: str(cust.state),
          email: str(contact.email) ?? str(cust.email),
          phone: str(contact.phone) ?? str(cust.phone),
        }
      },
    }
  })
}

type Props = {
  label: string
  onPick: (party: CourierPartyPick) => void
}

export default function CourierPartyPicker({ label, onPick }: Props) {
  const [mode, setMode] = useState<'customer' | 'agent'>('customer')
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)
  const [agentNoAddress, setAgentNoAddress] = useState(false)
  const debounced = useDebouncedValue(term, 250)

  useEffect(() => {
    let cancelled = false
    const q = debounced.trim()
    if (!open || q.length < 2) {
      setRows([])
      return
    }
    setLoading(true)
    ;(async () => {
      try {
        const hits = mode === 'customer' ? await searchCustomers(q) : await searchAgents(q)
        if (!cancelled) setRows(hits)
      } catch {
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [debounced, open, mode])

  async function selectHit(hit: Hit) {
    const party = await hit.pick()
    onPick(party)
    setAgentNoAddress(mode === 'agent' && !hasAddress(party))
    setTerm('')
    setOpen(false)
    setRows([])
  }

  const showMenu = open && debounced.trim().length >= 2

  return (
    <div className="cpp">
      <label className="cpp__label">{label}</label>
      <div className="cpp__row">
        <div className="cpp__input-wrap">
          <input
            className="input cpp__input"
            value={term}
            placeholder={mode === 'customer' ? 'Search customer by name…' : 'Search agent by name…'}
            onChange={(e) => { setTerm(e.target.value); setOpen(true); setAgentNoAddress(false) }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          />
          {showMenu && (
            <ul className="cpp__menu" role="listbox">
              {loading ? (
                <li className="cpp__empty">Searching…</li>
              ) : rows.length === 0 ? (
                <li className="cpp__empty">No matches.</li>
              ) : (
                rows.map((hit) => (
                  <li key={hit.key} role="option">
                    <button
                      type="button"
                      className="cpp__option"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => void selectHit(hit)}
                    >
                      <span className="cpp__option-name">{hit.label}</span>
                      <span className="cpp__option-meta">{hit.meta}</span>
                      {hit.isAgent && (
                        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#0A2472', background: '#E7EEFF', border: '1px solid #c7d2fe', borderRadius: 999, padding: '1px 7px' }}>
                          <Handshake size={11} /> Agent
                        </span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
        <div className="cpp__mode" role="tablist" aria-label="Party type">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'customer'}
            className={`cpp__mode-btn${mode === 'customer' ? ' cpp__mode-btn--on' : ''}`}
            onClick={() => { setMode('customer'); setAgentNoAddress(false) }}
          >
            Customer
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'agent'}
            className={`cpp__mode-btn${mode === 'agent' ? ' cpp__mode-btn--on' : ''}`}
            onClick={() => { setMode('agent'); setAgentNoAddress(false) }}
          >
            Agent
          </button>
        </div>
      </div>
      {agentNoAddress && (
        <p className="cpp__note">No address on file for this agent — enter the pickup/delivery address manually.</p>
      )}
    </div>
  )
}
