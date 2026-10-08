// Sales Support threads: "Create quote" (AI reads email + PDFs, fills a quote) and "Link to quote".
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { createQuoteFromConversation, linkQuote, searchQuotes, type InboxDetail, type QuoteHit } from './inboxApi'

const d = (x: string) => new Date(x).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })

export default function QuoteDialog({ detail, onChanged }: { detail: InboxDetail; onChanged: () => void }) {
  const nav = useNavigate()
  const convId = detail.conversation.id
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<QuoteHit[] | null>(null)
  const [pick, setPick] = useState<QuoteHit | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onLink = () => { setOpen(true); setQ(''); setPick(null) }
    const onCreate = () => {
      const t = toast.loading('Reading email and attachments…')
      createQuoteFromConversation(convId).then((r) => {
        toast.dismiss(t)
        toast.success(r.existing ? `Already linked to ${r.quote_no}` : `Quote ${r.quote_no} created`)
        if (r.low_confidence?.length) toast.message(`Check: ${r.low_confidence.slice(0, 6).join(', ')}`)
        onChanged()
        nav(`/quotes/${r.id}`)
      }).catch((e) => { toast.dismiss(t); toast.error(e instanceof Error ? e.message : 'Could not create quote') })
    }
    window.addEventListener('ibx:quote-link', onLink)
    window.addEventListener('ibx:create-quote', onCreate)
    return () => { window.removeEventListener('ibx:quote-link', onLink); window.removeEventListener('ibx:create-quote', onCreate) }
  }, [convId, nav, onChanged])
  useEffect(() => { setOpen(false) }, [convId])
  useEffect(() => {
    if (!open) return
    let live = true
    setHits(null)
    const t = setTimeout(() => {
      searchQuotes(convId, q.trim()).then((r) => { if (live) setHits(r ?? []) }).catch(() => { if (live) setHits([]) })
    }, q ? 250 : 0)
    return () => { live = false; clearTimeout(t) }
  }, [open, convId, q])

  if (!open) return null
  const close = () => setOpen(false)
  async function link(id: string | null, label: string) {
    setBusy(true)
    try { await linkQuote(convId, id); toast.success(label); close(); onChanged() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } finally { setBusy(false) }
  }

  return (
    <div className="ibx-modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="ibx-modal" role="dialog" aria-label="Link to quote">
        <header className="ibx-modal__head">
          <h3>Link to quote</h3>
          <button type="button" className="ibx-mail__icon" aria-label="Close" onClick={close}><X size={18} /></button>
        </header>
        <div className="ibx-modal__body">
          <label className="ibx-search" style={{ background: '#fff', border: '1px solid #E1DFDD' }}>
            <Search size={16} />
            <input autoFocus aria-label="Search quotes" placeholder="Quote no, customer, agent, email…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div style={{ fontSize: 12, color: '#605E5C', margin: '10px 2px 6px' }}>{q ? 'Results' : 'Suggested for this sender'}</div>
          <div className="ibx-jobs">
            {hits === null ? <div className="ibx-jobs__empty">Searching…</div> : null}
            {hits?.length === 0 ? <div className="ibx-jobs__empty">{q ? 'No quotes found.' : 'No quotes for this sender. Search above.'}</div> : null}
            {hits?.map((h) => (
              <button key={h.id} type="button" className={`ibx-job${pick?.id === h.id ? ' ibx-job--on' : ''}`} onClick={() => setPick(h)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="ibx-mono" style={{ fontWeight: 500 }}>{h.quote_no}</span>
                  {h.shipment_type ? <span className="ibx-chip" style={{ background: '#F3F2F1', color: '#424242' }}>{h.shipment_type}</span> : null}
                  {h.linked ? <span className="ibx-chip ibx-chip--done">Linked</span> : null}
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: '#605E5C', textTransform: 'capitalize' }}>{h.status}</span>
                </div>
                <div className="ibx-ellip" style={{ fontSize: 12.5, color: '#424242', marginTop: 3 }}>
                  {[h.customer, h.origin && h.destination ? `${h.origin} to ${h.destination}` : h.origin ?? h.destination, d(h.created_at)].filter(Boolean).join(' · ')}
                </div>
              </button>
            ))}
          </div>
        </div>
        <footer className="ibx-modal__foot">
          {detail.conversation.quote_id ? (
            <button type="button" className="ibx-btn" style={{ marginRight: 'auto' }} disabled={busy} onClick={() => void link(null, 'Unlinked')}>Unlink</button>
          ) : null}
          <button type="button" className="ibx-btn" onClick={close}>Cancel</button>
          <button type="button" className="ibx-btn ibx-btn--primary" disabled={!pick || busy}
            onClick={() => pick && void link(pick.id, `Linked to ${pick.quote_no}`)}>
            {busy ? 'Linking…' : pick ? `Link to ${pick.quote_no}` : 'Pick a quote'}
          </button>
        </footer>
      </div>
    </div>
  )
}
