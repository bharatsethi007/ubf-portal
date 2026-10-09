import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, RotateCcw, Send, Sparkles, Stamp } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { usePerm } from '@/access/PermissionsProvider'
import { money } from '@/features/quoteBooking/quoteBookingApi'
import {
  ACCOUNTS_EMAIL, docUrl, readWithAi, reopenInvoice, sendToAccounts, updateInvoice,
  type BookingMeta, type CreditorInvoice,
} from './creditorInvoicesApi'
import { stampAndSave } from './invoiceActions'
import { StatusPills, VerdictPill } from './invoiceUi'
import InvoiceFields from './InvoiceFields'
import InvoiceHistory from './InvoiceHistory'
import ApproveDialog from './ApproveDialog'
import DisputeDialog from './DisputeDialog'

type Props = { inv: CreditorInvoice; meta: BookingMeta; open: boolean; onOpenChange: (v: boolean) => void; onChanged: () => Promise<void> }

const iconBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 'auto', height: 32, padding: '0 10px' }

export default function InvoiceReviewDialog({ inv, meta, open, onOpenChange, onChanged }: Props) {
  const canApprove = usePerm('creditor_approve', 'edit')
  const [view, setView] = useState<'original' | 'stamped'>(inv.stamped_document_id ? 'stamped' : 'original')
  const [file, setFile] = useState<{ url: string; mime: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)
  const [approveOpen, setApproveOpen] = useState(false)
  const [disputeOpen, setDisputeOpen] = useState(false)

  const docId = view === 'stamped' && inv.stamped_document_id ? inv.stamped_document_id : inv.document_id
  useEffect(() => {
    if (!open || !docId) return
    setFile(null)
    docUrl(docId).then((d) => setFile({ url: d.url, mime: d.mime })).catch((e) => toast.error(e instanceof Error ? e.message : 'Preview failed'))
  }, [open, docId])

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true)
    try { await fn(); toast.success(label) } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { await onChanged(); setTick((t) => t + 1); setBusy(false) }
  }

  const save = (patch: Partial<CreditorInvoice>) => run('Saved', async () => {
    await updateInvoice(inv.id, patch)
    if (inv.status === 'approved') { await stampAndSave(inv.id, meta); setView('stamped') }
  })

  const c = inv.check_result
  const isImg = /^image\//.test(file?.mime ?? '')

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v) }}>
      <DialogContent className="sm:max-w-6xl" showCloseButton>
        <DialogHeader>
          <DialogTitle>{inv.vendor_name ?? 'Creditor invoice'} {inv.invoice_no ?? ''}</DialogTitle>
        </DialogHeader>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 1fr)', gap: 16, minHeight: 560 }}>
          <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: 8 }}>
            {inv.stamped_document_id ? (
              <div className="quotes-tabs">
                <button className={`quotes-tabs__btn${view === 'original' ? ' quotes-tabs__btn--on' : ''}`} onClick={() => setView('original')}>Original</button>
                <button className={`quotes-tabs__btn${view === 'stamped' ? ' quotes-tabs__btn--on' : ''}`} onClick={() => setView('stamped')}>Stamped</button>
              </div>
            ) : <div />}
            <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden', background: '#F8FAFC', minHeight: 520 }}>
              {!file && <p className="text-muted-foreground" style={{ padding: 16 }}>Loading preview…</p>}
              {file && isImg && <img src={file.url} alt="Invoice" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
              {file && !isImg && <iframe title="Invoice" src={file.url} style={{ width: '100%', height: '100%', minHeight: 520, border: 0 }} />}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 14, alignContent: 'start', maxHeight: 640, overflowY: 'auto' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <VerdictPill check={c} ai={inv.ai_status} /><StatusPills inv={inv} />
            </div>
            {c && c.expected != null && (
              <div className="text-sm" style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: 10, display: 'grid', gap: 4 }}>
                <div>Invoice {money(c.invoice, c.basis)} vs expected {money(c.expected, c.basis)}</div>
                {c.diff != null && <div className="text-muted-foreground">Difference {money(c.diff, c.basis)} · tolerance {money(c.tolerance, c.basis)}</div>}
              </div>
            )}
            {(c?.reasons?.length ?? 0) > 0 && <ul className="text-sm" style={{ margin: 0, paddingLeft: 18 }}>{c!.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
            {inv.ai_status === 'failed' && <p className="text-sm" style={{ color: '#B45309' }}>AI read failed: {inv.ai_error}</p>}
            {inv.status === 'disputed' && <p className="text-sm" style={{ color: '#B45309' }}>Disputed: {inv.dispute_reason}</p>}
            {inv.status === 'approved' && (
              <p className="text-sm text-muted-foreground">Approved by {inv.approved_by_name} · pay by {inv.pay_by}{inv.sent_at ? ` · sent to ${ACCOUNTS_EMAIL}` : ''}</p>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {inv.status !== 'approved' && (
                <button className="icon-btn" disabled={busy} title="Read again with AI" aria-label="Read again with AI"
                  onClick={() => void run('Invoice read', () => readWithAi(inv.id))}><Sparkles size={15} /></button>
              )}
              {inv.status !== 'approved' && canApprove && (
                <button className="btn btn--inline" style={iconBtn} disabled={busy || inv.total == null} title="Approve" aria-label="Approve"
                  onClick={() => setApproveOpen(true)}><CheckCircle2 size={15} /></button>
              )}
              {inv.status === 'received' && (
                <button className="icon-btn" disabled={busy} title="Dispute" aria-label="Dispute" onClick={() => setDisputeOpen(true)}><AlertTriangle size={15} /></button>
              )}
              {inv.status === 'disputed' && (
                <button className="icon-btn" disabled={busy} title="Reopen" aria-label="Reopen" onClick={() => void run('Reopened', () => reopenInvoice(inv.id))}><RotateCcw size={15} /></button>
              )}
              {inv.status === 'approved' && inv.needs_restamp && (
                <button className="icon-btn" disabled={busy} title="Stamp again" aria-label="Stamp again"
                  onClick={() => void run('Stamped', async () => { await stampAndSave(inv.id, meta); setView('stamped') })}><Stamp size={15} /></button>
              )}
              {inv.stamped_document_id && (
                <button className="icon-btn" disabled={busy} title="Download stamped PDF" aria-label="Download stamped PDF"
                  onClick={async () => { const d = await docUrl(inv.stamped_document_id!); window.open(d.url, '_blank', 'noopener') }}><Download size={15} /></button>
              )}
              {inv.status === 'approved' && inv.stamped_document_id && !inv.needs_restamp && (
                <button className="btn btn--inline" style={iconBtn} disabled={busy} title={`Email to ${ACCOUNTS_EMAIL}, cc approver`} aria-label={`Email to ${ACCOUNTS_EMAIL}, cc approver`}
                  onClick={() => void run(`Sent to ${ACCOUNTS_EMAIL}, cc ${inv.approved_by_name ?? 'approver'}`, () => sendToAccounts(inv, meta))}><Send size={15} /></button>
              )}
            </div>
            {!canApprove && inv.status !== 'approved' && <p className="text-sm text-muted-foreground">Approval needs finance or admin access.</p>}

            <InvoiceFields key={`${inv.id}-${inv.version}-${tick}`} inv={inv} busy={busy} onSave={(p) => void save(p)} />
            <InvoiceHistory invoiceId={inv.id} tick={tick} />
          </div>
        </div>

        {approveOpen && <ApproveDialog inv={inv} meta={meta} open={approveOpen} onOpenChange={setApproveOpen}
          onDone={() => { void onChanged(); setTick((t) => t + 1); setView('stamped') }} />}
        {disputeOpen && <DisputeDialog inv={inv} open={disputeOpen} onOpenChange={setDisputeOpen}
          onDone={() => { void onChanged(); setTick((t) => t + 1) }} />}
      </DialogContent>
    </Dialog>
  )
}
