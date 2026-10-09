import { useCallback, useEffect, useRef, useState } from 'react'
import { Eye, FolderOpen, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { money } from '@/features/quoteBooking/quoteBookingApi'
import {
  createFromDocument, createFromUpload, deleteInvoice, fetchBookingMeta, listInvoices, readWithAi,
  type BookingMeta, type CreditorInvoice,
} from './creditorInvoicesApi'
import { StatusPills, VerdictPill } from './invoiceUi'
import InvoiceReviewDialog from './InvoiceReviewDialog'
import PickDocumentDialog from './PickDocumentDialog'
import { nzDate } from './stampPdf'

type Props = { bookingId: string; onChanged: () => void }

const iconFilled: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 'auto', height: 30, padding: '0 10px' }

export default function CreditorInvoicesCard({ bookingId, onChanged }: Props) {
  const [rows, setRows] = useState<CreditorInvoice[]>([])
  const [meta, setMeta] = useState<BookingMeta | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [pickOpen, setPickOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const load = useCallback(async () => {
    try { const [r, m] = await Promise.all([listInvoices(bookingId), fetchBookingMeta(bookingId)]); setRows(r); setMeta(m) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to load invoices') }
  }, [bookingId])
  useEffect(() => { void load() }, [load])

  const reload = async () => { await load(); onChanged() }

  async function addAndRead(create: () => Promise<string>) {
    setBusy(true)
    try {
      const id = await create()
      await load()
      setOpenId(id)
      toast.message('Reading invoice…')
      await readWithAi(id).catch((e) => toast.error(e instanceof Error ? e.message : 'AI read failed. Enter details by hand.'))
      await reload()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not add invoice') }
    finally { setBusy(false) }
  }

  async function onFiles(list: FileList | null) {
    if (!list?.length || !meta) return
    for (const f of Array.from(list)) await addAndRead(() => createFromUpload(bookingId, meta.account_id, f))
  }

  async function remove(inv: CreditorInvoice) {
    if (!window.confirm(`Remove invoice ${inv.invoice_no ?? ''} from this job? The file stays in Documents.`)) return
    try { await deleteInvoice(inv.id); await reload() } catch (e) { toast.error(e instanceof Error ? e.message : 'Delete failed') }
  }

  const open = rows.find((r) => r.id === openId) ?? null
  const totalNzd = rows.filter((r) => r.status !== 'disputed').reduce((s, r) => s + Number(r.total_nzd || 0), 0)

  return (
    <section className="bk-card"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); void onFiles(e.dataTransfer.files) }}>
      <div className="bk-card__toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn--inline" style={iconFilled} disabled={busy || !meta} title="Upload creditor invoice" aria-label="Upload creditor invoice"
            onClick={() => fileRef.current?.click()}><Upload size={15} /></button>
          <button className="icon-btn" disabled={busy} title="Use a booking document" aria-label="Use a booking document" onClick={() => setPickOpen(true)}><FolderOpen size={15} /></button>
          <span style={{ fontWeight: 500, marginLeft: 4 }}>Creditor invoices</span>
          <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg" multiple hidden
            onChange={(e) => { void onFiles(e.target.files); e.target.value = '' }} />
        </div>
        {rows.length > 0 && <span className="text-sm text-muted-foreground">NZD {money(totalNzd)} invoiced</span>}
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground" style={{ padding: 16 }}>No creditor invoices. Upload or drop a PDF here, or pick one from Documents.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Vendor</th><th>Invoice</th><th>Date</th><th style={{ textAlign: 'right' }}>Total</th><th style={{ textAlign: 'right' }}>NZD</th>
                <th>Check</th><th>Status</th><th>Pay by</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="row-clickable" onClick={() => setOpenId(r.id)}>
                  <td>{r.vendor_name ?? <span className="text-muted-foreground">Unknown</span>}</td>
                  <td className="mono">{r.invoice_no ?? '-'}</td>
                  <td>{r.invoice_date ? nzDate(r.invoice_date) : '-'}</td>
                  <td style={{ textAlign: 'right' }}>{money(r.total, r.currency)}</td>
                  <td style={{ textAlign: 'right' }}>{r.total != null ? money(r.total_nzd) : '-'}</td>
                  <td><VerdictPill check={r.check_result} ai={r.ai_status} /></td>
                  <td><StatusPills inv={r} /></td>
                  <td>{r.pay_by ? nzDate(r.pay_by) : '-'}</td>
                  <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                    <button className="icon-btn" title="Open" aria-label="Open" onClick={() => setOpenId(r.id)}><Eye size={14} /></button>
                    {r.status !== 'approved' && (
                      <button className="icon-btn" title="Remove" aria-label="Remove" onClick={() => void remove(r)}><Trash2 size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PickDocumentDialog bookingId={bookingId} open={pickOpen} onOpenChange={setPickOpen}
        onPick={(docId) => addAndRead(() => createFromDocument(bookingId, docId))} />
      {open && meta && (
        <InvoiceReviewDialog key={open.id} inv={open} meta={meta} open={Boolean(open)}
          onOpenChange={(v) => { if (!v) setOpenId(null) }} onChanged={reload} />
      )}
    </section>
  )
}
