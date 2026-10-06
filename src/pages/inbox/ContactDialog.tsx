// "Who is this?" popup: link sender to a customer account or save them as lead / carrier / shipper. Replaces the old side panel.
import { useEffect, useState } from 'react'
import { Boxes, Plus, Search, Truck, X } from 'lucide-react'
import { toast } from 'sonner'
import { linkContact, searchAccounts, type ContactType, type InboxDetail } from './inboxApi'

const TYPES: { key: ContactType; label: string; hint: string; icon: typeof Plus; bg: string; fg: string }[] = [
  { key: 'lead', label: 'New lead', hint: 'Potential customer, start a quote', icon: Plus, bg: '#ECFDF3', fg: '#067647' },
  { key: 'carrier', label: 'Carrier / transport', hint: 'Trucking, carriers, depots', icon: Truck, bg: '#FFF4E5', fg: '#9A4A00' },
  { key: 'shipper', label: 'Shipper / supplier / agent', hint: 'Works on a customer’s shipments', icon: Boxes, bg: '#F4F3FF', fg: '#5B21B6' },
]

export default function ContactDialog({ detail, onChanged }: { detail: InboxDetail; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<{ account_id: string; name: string }[]>([])
  const [busy, setBusy] = useState(false)
  const id = detail.conversation.id

  useEffect(() => {
    const on = () => { setOpen(true); setQ(''); setHits([]) }
    window.addEventListener('ibx:contact', on)
    return () => window.removeEventListener('ibx:contact', on)
  }, [])
  useEffect(() => { setOpen(false) }, [id])
  useEffect(() => {
    const t = setTimeout(() => { searchAccounts(q).then(setHits).catch(() => setHits([])) }, 250)
    return () => clearTimeout(t)
  }, [q])

  if (!open) return null

  async function link(type: ContactType, account?: { account_id: string; name: string }) {
    setBusy(true)
    try {
      await linkContact(id, type, account?.account_id)
      toast.success(account ? `Linked to ${account.name}` : 'Contact saved')
      setOpen(false); onChanged()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setBusy(false) }
  }

  return (
    <div className="ibx-modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
      <div className="ibx-modal" style={{ width: 460 }} role="dialog" aria-label="Who is this">
        <header className="ibx-modal__head">
          <h3>Who is this?</h3>
          <button type="button" className="ibx-mail__icon" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
        </header>
        <div className="ibx-modal__body">
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#605E5C' }}>
            {detail.email?.contact_email ?? (detail.contact ? `+${detail.contact.wa_id}` : '')}. Link once, next messages go to the right place.
          </p>
          <div className="ibx-modal__label">Existing customer</div>
          <label className="ibx-search" style={{ background: '#fff', border: '1px solid #E1DFDD' }}>
            <Search size={16} />
            <input autoFocus aria-label="Search customer accounts" placeholder="Search customer accounts…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          {hits.length ? (
            <div className="ibx-hits">
              {hits.map((h) => (
                <button key={h.account_id} type="button" disabled={busy} onClick={() => void link('customer', h)}>
                  {h.name} <span className="ibx-mono" style={{ color: '#605E5C' }}>{h.account_id}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="ibx-modal__label" style={{ marginTop: 16 }}>Or save as</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TYPES.map(({ key, label, hint, icon: Icon, bg, fg }) => (
              <button key={key} type="button" className="ibx-opt" disabled={busy} onClick={() => void link(key)}>
                <span className="ibx-opt__icon" style={{ background: bg, color: fg }}><Icon size={16} /></span>
                <span>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 500 }}>{label}</span>
                  <span style={{ display: 'block', fontSize: 12, color: '#605E5C' }}>{hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
