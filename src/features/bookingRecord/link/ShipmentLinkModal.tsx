import { useEffect, useMemo, useState } from 'react'
import { Check, Link2, Loader2, Search, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { findConsigneeShipments, linkBookingToShipment, type LinkShipment } from './shipmentLinkApi'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  bookingId: string
  accountId: string | null
  consigneeName: string | null
  expectedContainers: string[]
  onLinked: (jobUnique: number, consolKey: string | null) => void
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ShipmentLinkModal({ open, onOpenChange, bookingId, accountId, consigneeName, expectedContainers, onLinked }: Props) {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<LinkShipment[]>([])
  const [busyId, setBusyId] = useState<number | null>(null)
  const [q, setQ] = useState('')

  const expected = useMemo(
    () => new Set(expectedContainers.map((c) => c.trim().toUpperCase()).filter(Boolean)),
    [expectedContainers],
  )

  useEffect(() => {
    if (!open) return
    setQ('')
    setLoading(true)
    findConsigneeShipments(accountId, consigneeName)
      .then(setRows)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Lookup failed'))
      .finally(() => setLoading(false))
  }, [open, accountId, consigneeName])

  // rank: container match first, then invoice presence, then recency
  const ranked = useMemo(() => {
    const scored = rows.map((s) => {
      const match = s.containers.some((c) => expected.has(c.container_no.trim().toUpperCase()))
      return { s, match }
    })
    scored.sort((a, b) =>
      Number(b.match) - Number(a.match) ||
      (b.s.invoice_count > 0 ? 1 : 0) - (a.s.invoice_count > 0 ? 1 : 0) ||
      (b.s.eta ?? '').localeCompare(a.s.eta ?? ''),
    )
    return scored
  }, [rows, expected])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return ranked
    return ranked.filter(({ s }) =>
      [s.consol_key, s.master_bill, s.origin, s.destination, s.vessel_flight, ...s.containers.map((c) => c.container_no)]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(t)),
    )
  }, [ranked, q])

  const suggestedId = ranked[0]?.match ? ranked[0].s.job_unique : null

  async function link(s: LinkShipment) {
    setBusyId(s.job_unique)
    try {
      await linkBookingToShipment(bookingId, s.job_unique, s.consol_key)
      onLinked(s.job_unique, s.consol_key)
      toast.success(`Linked to ${s.consol_key ?? s.job_unique}`)
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Link failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ width: 'min(920px, 94vw)', maxWidth: 'min(920px, 94vw)' }}>
        <DialogHeader>
          <DialogTitle>Link Cyber Freight shipment{consigneeName ? ` — ${consigneeName}` : ''}</DialogTitle>
        </DialogHeader>

        <div className="link-search">
          <Search size={15} className="link-search__ico" />
          <input
            className="link-search__input"
            placeholder="Search consol, container, B/L, vessel…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
        </div>

        {loading ? (
          <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}><Loader2 className="spin" /></div>
        ) : filtered.length === 0 ? (
          <p className="muted" style={{ fontSize: 13, padding: 16, textAlign: 'center' }}>
            {rows.length === 0 ? 'No import-sea shipments found for this consignee in Cyber Freight.' : 'No shipments match your search.'}
          </p>
        ) : (
          <div className="link-list">
            {filtered.map(({ s, match }) => {
              const suggested = s.job_unique === suggestedId
              return (
                <div key={s.job_unique} className={`link-card${match ? ' link-card--match' : ''}${suggested ? ' link-card--suggested' : ''}`}>
                  <div className="link-card__top">
                    <span className="link-card__consol mono">{s.consol_key ?? `#${s.job_unique}`}</span>
                    {suggested ? <span className="link-badge link-badge--suggest"><Sparkles size={11} /> Suggested</span> : null}
                    {match ? <span className="link-badge link-badge--match"><Check size={11} /> Container match</span> : null}
                    {s.already_linked ? <span className="link-badge link-badge--muted">Already linked</span> : null}
                    <span className="link-card__inv">
                      {s.invoice_count} inv{s.invoice_total != null ? ` · $${s.invoice_total.toLocaleString()}` : ''}
                    </span>
                    <button
                      type="button"
                      className={`btn${suggested ? '' : ' btn--ghost'} link-card__btn`}
                      disabled={busyId === s.job_unique}
                      onClick={() => void link(s)}
                    >
                      {busyId === s.job_unique ? <Loader2 size={13} className="spin" /> : <Link2 size={13} />} Link
                    </button>
                  </div>
                  <div className="link-card__meta">
                    {s.origin ?? '—'} → {s.destination ?? '—'} · ETA {fmtDate(s.eta)}{s.vessel_flight ? ` · ${s.vessel_flight}` : ''}
                  </div>
                  <div className="link-card__containers mono">
                    {s.containers.length ? s.containers.map((c) => c.container_no).join(', ') : 'No containers in FDB'}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
