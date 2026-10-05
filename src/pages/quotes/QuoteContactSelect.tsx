import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { UserRound } from 'lucide-react'
import { supabase } from '../../supabase'
import { updateQuote } from './quotesApi'

export type QuoteContact = { contact_name: string | null; contact_email: string | null; contact_phone: string | null }
type Opt = { id: string; name: string; email: string; phone: string; prime: boolean }
type Props = { quoteId: string; accountId: string | null; value: QuoteContact; onSaved: (v: QuoteContact) => void }

const OTHER = '__other'
const EMPTY: QuoteContact = { contact_name: null, contact_email: null, contact_phone: null }

async function fetchContacts(accountId: string): Promise<Opt[]> {
  const { data } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, phone, is_prime')
    .eq('account_id', accountId)
    .order('is_prime', { ascending: false })
  return (data ?? [])
    .map((c) => ({
      id: String(c.id),
      name: [c.first_name, c.last_name].filter(Boolean).join(' ').trim(),
      email: c.email ?? '',
      phone: c.phone ?? '',
      prime: !!c.is_prime,
    }))
    .filter((c) => c.name || c.email)
}

export default function QuoteContactSelect({ quoteId, accountId, value, onSaved }: Props) {
  const [opts, setOpts] = useState<Opt[]>([])
  const [other, setOther] = useState(false)
  const [draft, setDraft] = useState<QuoteContact>(value)

  useEffect(() => {
    if (!accountId) { setOpts([]); return }
    let off = false
    void fetchContacts(accountId).then((o) => { if (!off) setOpts(o) })
    return () => { off = true }
  }, [accountId])

  const matchId = opts.find((o) => o.name === (value.contact_name ?? '') && o.email === (value.contact_email ?? ''))?.id
  const selected = !value.contact_name && !value.contact_email ? '' : matchId ?? OTHER

  async function save(v: QuoteContact) {
    try {
      await updateQuote(quoteId, v)
      onSaved(v)
      toast.success('Contact updated')
    } catch { toast.error('Failed to update contact') }
  }

  function onPick(id: string) {
    if (id === OTHER) { setDraft(selected === OTHER ? value : EMPTY); setOther(true); return }
    setOther(false)
    if (!id) { void save(EMPTY); return }
    const o = opts.find((x) => x.id === id)
    if (o) void save({ contact_name: o.name || null, contact_email: o.email || null, contact_phone: o.phone || null })
  }

  function saveOther() {
    const v: QuoteContact = {
      contact_name: draft.contact_name?.trim() || null,
      contact_email: draft.contact_email?.trim() || null,
      contact_phone: draft.contact_phone?.trim() || null,
    }
    setOther(false)
    void save(v)
  }

  if (!accountId) return null
  return (
    <span className="flex items-center gap-2">
      <UserRound size={14} className="text-slate-500" />
      <select
        className="nqd-input"
        style={{ width: 'auto', height: 30, padding: '4px 8px' }}
        title="Contact on quote PDF"
        value={other ? OTHER : selected}
        onChange={(e) => onPick(e.target.value)}
      >
        <option value="">Default contact</option>
        {opts.map((o) => (
          <option key={o.id} value={o.id}>{o.name || o.email}{o.prime ? ' (main)' : ''}</option>
        ))}
        <option value={OTHER}>{selected === OTHER && !other ? (value.contact_name || value.contact_email) : 'Other…'}</option>
      </select>
      {other && (
        <>
          <input className="nqd-input" style={{ width: 140, height: 30 }} placeholder="Name" value={draft.contact_name ?? ''} onChange={(e) => setDraft({ ...draft, contact_name: e.target.value })} />
          <input className="nqd-input" style={{ width: 180, height: 30 }} placeholder="Email" value={draft.contact_email ?? ''} onChange={(e) => setDraft({ ...draft, contact_email: e.target.value })} />
          <input className="nqd-input" style={{ width: 120, height: 30 }} placeholder="Phone" value={draft.contact_phone ?? ''} onChange={(e) => setDraft({ ...draft, contact_phone: e.target.value })} />
          <button className="nqd-btn nqd-btn--accent" onClick={saveOther}>Save</button>
          <button className="nqd-btn" onClick={() => setOther(false)}>Cancel</button>
        </>
      )}
    </span>
  )
}
