import { useEffect, useState } from 'react'
import { Link2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { fetchQuoteSuggestions, linkQuoteToBooking, money, type QuoteSuggestion } from './quoteBookingApi'

type Props = {
  bookingId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onLinked: () => void
}

const STATUS_CLASS: Record<string, string> = { won: 'bk-pill bk-pill--green', lost: 'bk-pill', crosswin: 'bk-pill' }

export default function QuoteLinkDialog({ bookingId, open, onOpenChange, onLinked }: Props) {
  const [includeOpen, setIncludeOpen] = useState(false)
  const [includeLost, setIncludeLost] = useState(false)
  const [search, setSearch] = useState('')
  const q = useDebouncedValue(search, 300)
  const [rows, setRows] = useState<QuoteSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    fetchQuoteSuggestions(bookingId, includeOpen, includeLost, q)
      .then((r) => { if (alive) setRows(r) })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load quotes'))
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [open, bookingId, includeOpen, includeLost, q])

  async function link(id: string) {
    setBusyId(id)
    try {
      await linkQuoteToBooking(id, bookingId)
      toast.success('Quote linked')
      onOpenChange(false)
      onLinked()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Link failed')
    } finally { setBusyId(null) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl" showCloseButton>
        <DialogHeader><DialogTitle>Link quote</DialogTitle></DialogHeader>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: 280 }}>
            <Search size={14} style={{ position: 'absolute', left: 9, top: 9, color: '#94a3b8' }} />
            <input className="input input--sm" style={{ paddingLeft: 28, width: 280 }} placeholder="Quote no, customer, port, party"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <label className="text-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={includeOpen} onChange={(e) => setIncludeOpen(e.target.checked)} /> Include open
          </label>
          <label className="text-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={includeLost} onChange={(e) => setIncludeLost(e.target.checked)} /> Include lost
          </label>
        </div>
        <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto', marginTop: 8 }}>
          <table className="data-table">
            <thead>
              <tr><th>Quote</th><th>Status</th><th>Customer</th><th>Lane</th><th>Type</th><th style={{ textAlign: 'right' }}>Sell</th><th>Match</th><th /></tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="text-muted-foreground pad-inline">Loading…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="text-muted-foreground pad-inline">No unlinked quotes. Try ticking open or lost, or search.</td></tr>
              )}
              {!loading && rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.quote_no ?? '-'}</td>
                  <td><span className={STATUS_CLASS[r.status] ?? 'bk-pill bk-pill--amber'}>{r.status}</span></td>
                  <td>{r.customer_name ?? '-'}</td>
                  <td className="mono">{r.from_port_code ?? '?'} → {r.to_port_code ?? '?'}</td>
                  <td>{[r.shipment_mode, r.movement_type, r.shipment_type].filter(Boolean).join(' · ')}</td>
                  <td style={{ textAlign: 'right' }}>{money(r.total_sell, r.currency)}</td>
                  <td>{r.score >= 60 ? <span className="bk-pill bk-pill--green">Strong</span> : r.score >= 30 ? <span className="bk-pill bk-pill--amber">Likely</span> : null}</td>
                  <td>
                    <button className="icon-btn" title="Link this quote" aria-label="Link this quote"
                      disabled={busyId !== null} onClick={() => void link(r.id)}><Link2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  )
}
