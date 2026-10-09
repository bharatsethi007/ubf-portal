import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { disputeInvoice, type CreditorInvoice } from './creditorInvoicesApi'

type Props = { inv: CreditorInvoice; open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }

export default function DisputeDialog({ inv, open, onOpenChange, onDone }: Props) {
  const reasons = inv.check_result?.reasons ?? []
  const [reason, setReason] = useState(reasons.join('. '))
  const [busy, setBusy] = useState(false)

  async function go() {
    setBusy(true)
    try { await disputeInvoice(inv.id, reason); toast.success('Marked as disputed'); onOpenChange(false); onDone() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v) }}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader><DialogTitle>Dispute invoice</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{inv.vendor_name ?? 'Vendor'} {inv.invoice_no ?? ''}. Stays on the job, not sent to accounts.</p>
        <textarea className="input" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What is wrong with this invoice?" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
          <button className="text-link" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</button>
          <button className="btn btn--inline" disabled={busy || !reason.trim()} onClick={() => void go()}
            style={{ width: 'auto', background: '#B45309' }}>{busy ? 'Saving…' : 'Dispute'}</button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
