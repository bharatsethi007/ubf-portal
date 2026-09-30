import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Loader2, MessageSquare, X } from 'lucide-react'
import { detailPath, fmtDay } from '../homeModel'
import { STATUS, daysLate, docLabel, fetchInvoiceDetail, money2, statusOf, type BillInvoice, type InvoiceDetail } from './billingApi'
import { downloadInvoicePdf } from './pdf/invoiceDocApi'
import './billing.css'
import { useMessageDock } from '../messages/MessagesDock'

type Props = { inv: BillInvoice; onClose: () => void; fromShipment?: boolean }

/** One invoice on screen: status, balance, and every charge line. */
export default function InvoiceDrawer({ inv, onClose, fromShipment }: Props) {
  const [d, setD] = useState<InvoiceDetail | null>(null)
  const { openMessages } = useMessageDock()
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfErr, setPdfErr] = useState('')
  const st = statusOf(inv)
  const cur = inv.currency

  useEffect(() => {
    let alive = true
    setLoading(true); setErr(''); setD(null)
    fetchInvoiceDetail(inv.invoice_no)
      .then((r) => { if (alive) setD(r) })
      .catch((e) => { if (alive) setErr(e.message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [inv.invoice_no])

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const subject = `Invoice ${inv.invoice_no}${inv.shipment_no ? ` / ${inv.shipment_no}` : ''}`
  const ask = () => openMessages({ job: inv.job_unique, subject, compose: true })

  async function savePdf() {
    setPdfBusy(true); setPdfErr('')
    try { await downloadInvoicePdf(inv.invoice_no, d?.lines ?? []) } catch (e) { setPdfErr(e instanceof Error ? e.message : 'PDF could not be made.') }
    finally { setPdfBusy(false) }
  }
  const net = (d?.lines ?? []).reduce((n, l) => n + l.amount, 0)

  return (
    <div className="pv3-bill__drawer" role="dialog" aria-modal="true" aria-label={`Invoice ${inv.invoice_no}`}>
      <button type="button" className="pv3-bill__scrim" aria-label="Close" onClick={onClose} />
      <aside className="pv3-bill__panel">
        <header className="pv3-bill__dhead">
          <div>
            <span className="pv3-bill__dtype">{docLabel(inv.doctype)} invoice</span>
            <h2 className="pv3-mono">{inv.invoice_no}</h2>
            <span className={`pv3-bill__st pv3-bill__st--${STATUS[st].tone}`}>
              {STATUS[st].label}{st === 'overdue' ? ` · ${daysLate(inv)} days` : ''}
            </span>
          </div>
          <button type="button" className="pv3-iconbtn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>

        <div className="pv3-bill__due">
          <div>
            <span>{inv.due > 0.009 ? 'Balance due' : 'Invoice total'}</span>
            <b>{money2(inv.due > 0.009 ? inv.due : inv.amount, cur)}</b>
            {cur !== 'NZD' && <i>≈ {money2(inv.due > 0.009 ? inv.due_nzd : inv.amount_nzd)}</i>}
          </div>
          <dl>
            <div><dt>Issued</dt><dd>{fmtDay(inv.doc_date)}</dd></div>
            <div><dt>Due</dt><dd className={st === 'overdue' ? 'pv3-bill__red' : ''}>{fmtDay(inv.date_due)}</dd></div>
            {inv.due > 0.009 && inv.due < inv.amount - 0.009 && <div><dt>Paid so far</dt><dd>{money2(inv.amount - inv.due, cur)}</dd></div>}
          </dl>
        </div>

        {inv.job_unique != null && !fromShipment && (
          <Link to={detailPath({ job_unique: inv.job_unique })} className="pv3-bill__ship">
            <div>
              <b className="pv3-mono">{inv.shipment_no ?? `#${inv.job_unique}`}</b>
              <span>{[inv.origin, inv.destination].filter(Boolean).join(' → ')}{inv.party ? ` · ${inv.party}` : ''}</span>
              {inv.customer_ref && <span className="pv3-cell-sub">Your ref {inv.customer_ref}</span>}
            </div>
            <span className="pv3-link">Shipment</span>
          </Link>
        )}

        <h3 className="pv3-bill__h3">Charges</h3>
        {loading && <div className="pv3-skel-list">{[0, 1, 2].map((i) => <span key={i} className="pv3-skel" />)}</div>}
        {err && <div className="pv3-error">{err}</div>}
        {!loading && d && (
          <table className="pv3-bill__lines">
            <tbody>
              {d.lines.map((l, i) => (
                <tr key={i}>
                  <td>{l.description ?? l.code}{l.gst_rate > 0 && <span className="pv3-bill__gst">+GST</span>}</td>
                  <td>{money2(l.amount, cur)}</td>
                </tr>
              ))}
              {!d.itemised && (
                <tr className="pv3-bill__gap"><td colSpan={2}>
                  {d.lines.length ? 'Some charges on this invoice aren’t itemised here. The total below is correct.' : 'Charge detail isn’t available for this invoice. The total below is correct.'}
                </td></tr>
              )}
            </tbody>
            <tfoot>
              {d.itemised && <tr><td>Subtotal</td><td>{money2(net, cur)}</td></tr>}
              <tr><td>GST</td><td>{money2(inv.gst, cur)}</td></tr>
              <tr className="pv3-bill__total"><td>Total</td><td>{money2(inv.amount, cur)}</td></tr>
            </tfoot>
          </table>
        )}

        <div className="pv3-bill__actions">
          <button type="button" className="pv3-btn pv3-btn--primary" disabled={loading || pdfBusy} onClick={() => void savePdf()}>
            {pdfBusy ? <Loader2 size={15} className="pv3-spin" /> : <Download size={15} />} Download PDF
          </button>
          <button type="button" className="pv3-btn pv3-btn--ghost" onClick={ask}><MessageSquare size={15} /> Ask about this invoice</button>
        </div>
        {pdfErr && <div className="pv3-error">{pdfErr}</div>}
        <p className="pv3-bill__fine">The PDF is a duplicate copy for your records. Ask us in messages for the original. Quote the invoice number when you pay.</p>
      </aside>
    </div>
  )
}
