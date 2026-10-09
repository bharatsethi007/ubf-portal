import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import DateField from '@/components/DateField'
import { approveInvoice, type BookingMeta, type CreditorInvoice } from './creditorInvoicesApi'
import { payBySuggestions, stampAndSave } from './invoiceActions'
import { nzDate } from './stampPdf'

type Props = { inv: CreditorInvoice; meta: BookingMeta; open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }

export default function ApproveDialog({ inv, meta, open, onOpenChange, onDone }: Props) {
  const sugg = payBySuggestions(meta.eta, inv.due_date)
  const [payBy, setPayBy] = useState<string>(sugg[0].value)
  const [urgent, setUrgent] = useState(false)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  async function go() {
    setBusy(true)
    try {
      await approveInvoice(inv.id, payBy, urgent, comment)
      await stampAndSave(inv.id, meta)
      toast.success('Approved and stamped')
      onOpenChange(false); onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Approval failed')
      onDone()
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v) }}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader><DialogTitle>Approve invoice</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          {inv.vendor_name ?? 'Vendor'} {inv.invoice_no ?? ''} · {inv.currency} {Number(inv.total ?? 0).toLocaleString('en-NZ', { minimumFractionDigits: 2 })}
          {meta.eta ? ` · ETA ${nzDate(meta.eta)}` : ''}
        </p>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <div className="text-sm" style={{ marginBottom: 4 }}>Pay by</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <DateField value={payBy} onChange={(v) => v && setPayBy(v)} width={160} />
              {sugg.map((s) => (
                <button key={s.label} className={`quotes-tabs__btn${payBy === s.value ? ' quotes-tabs__btn--on' : ''}`}
                  onClick={() => setPayBy(s.value)} title={nzDate(s.value)}>{s.label}</button>
              ))}
            </div>
          </div>
          <label className="text-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /> Mark as urgent
          </label>
          <div>
            <div className="text-sm" style={{ marginBottom: 4 }}>Comment</div>
            <textarea className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional. Printed on the stamp." />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
          <button className="text-link" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</button>
          <button className="btn btn--inline" disabled={busy || !payBy} onClick={() => void go()} title="Approve and stamp" aria-label="Approve and stamp"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: 'auto', background: urgent ? '#B91C1C' : undefined }}>
            <CheckCircle2 size={15} /> {busy ? 'Stamping…' : 'Approve'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
