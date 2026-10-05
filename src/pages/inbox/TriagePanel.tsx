import { useEffect, useState } from 'react'
import { Ban, Boxes, Plus, Search, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { linkContact, searchAccounts, type ContactType, type InboxDetail } from './inboxApi'

const TYPES: { key: ContactType; label: string; hint: string; icon: typeof Plus; bg: string; fg: string }[] = [
  { key: 'lead', label: 'New lead', hint: 'Potential customer, start a quote', icon: Plus, bg: '#ECFDF3', fg: '#067647' },
  { key: 'carrier', label: 'Carrier / transport', hint: 'Trucking, carriers, depots', icon: Truck, bg: '#FFF4E5', fg: '#9A4A00' },
  { key: 'shipper', label: 'Shipper / supplier / agent', hint: 'Works on a customer’s shipments', icon: Boxes, bg: '#F4F3FF', fg: '#5B21B6' },
  { key: 'spam', label: 'Spam / not relevant', hint: 'Closes this conversation', icon: Ban, bg: '#F1F5F9', fg: '#475467' },
]

export default function TriagePanel({ detail, onChanged }: { detail: InboxDetail; onChanged: () => void }) {
  const id = detail.conversation.id
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<{ account_id: string; name: string }[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => { searchAccounts(q).then(setHits).catch(() => setHits([])) }, 250)
    return () => clearTimeout(t)
  }, [q])

  async function link(type: ContactType, account?: { account_id: string; name: string }) {
    setBusy(true)
    try {
      await linkContact(id, type, account?.account_id)
      toast.success(account ? `Linked to ${account.name}` : 'Contact saved')
      onChanged()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setBusy(false) }
  }

  return (
    <aside className="ibx-side ibx-pane" aria-label="Identify sender">
      <div>
        <h3 style={{ fontSize: 15, marginBottom: 4 }}>Who is this?</h3>
        <p style={{ margin: 0, fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>
          Link once. Next messages from this number go straight to the right place.
        </p>
      </div>

      <div>
        <label className="ibx-search" style={{ background: '#fff', border: '1px solid #E2E8F0' }}>
          <Search size={16} />
          <input aria-label="Search customer accounts" placeholder="Link to customer account…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {hits.length ? (
          <div className="ibx-hits">
            {hits.map((h) => (
              <button key={h.account_id} type="button" disabled={busy} onClick={() => link('customer', h)}>
                <span style={{ fontWeight: 600 }}>{h.name}</span> <span className="ibx-mono" style={{ color: '#64748B' }}>{h.account_id}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="ibx-sect" style={{ padding: 0 }}>Or save as</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {TYPES.map(({ key, label, hint, icon: Icon, bg, fg }) => (
          <button key={key} type="button" className="ibx-opt" disabled={busy} onClick={() => link(key)}>
            <span className="ibx-opt__icon" style={{ background: bg, color: fg }}><Icon size={16} /></span>
            <span>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{label}</span>
              <span style={{ display: 'block', fontSize: 12, color: '#64748B' }}>{hint}</span>
            </span>
          </button>
        ))}
      </div>
    </aside>
  )
}
