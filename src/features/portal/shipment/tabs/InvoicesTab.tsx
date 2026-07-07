import { formatMoney, formatShortDate } from '../../dashboard/portalFormat'
import type { Invoice } from '../../../../types/invoice'
import { invoiceStatus } from '../../../../types/invoice'

type Props = { invoices: Invoice[]; loading?: boolean }

function StatusPill({ status }: { status: ReturnType<typeof invoiceStatus> }) {
  const cls =
    status === 'Paid' ? 'portal-pill portal-pill--green'
    : status === 'Part-paid' ? 'portal-pill portal-pill--amber'
    : 'portal-pill portal-pill--grey'
  return <span className={cls}>{status}</span>
}

export default function InvoicesTab({ invoices, loading }: Props) {
  if (loading) return <p className="portal-empty">Loading invoices…</p>
  if (!invoices.length) {
    return <p className="portal-empty">No invoices linked to this shipment.</p>
  }

  return (
    <div className="portal-table-wrap">
      <table className="portal-table">
        <thead>
          <tr>
            {['Invoice #', 'Type', 'Date', 'Due', 'Amount', 'Balance', 'Status'].map((h) => (
              <th key={h} className={h === 'Amount' || h === 'Balance' ? 'portal-th--nums' : undefined}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.invoice_no}>
              <td className="nums">{inv.invoice_no}</td>
              <td>{inv.doctype ?? '—'}</td>
              <td className="nums">{formatShortDate(inv.doc_date)}</td>
              <td className="nums">{formatShortDate(inv.date_due)}</td>
              <td className="portal-td--nums nums">{formatMoney(inv.amt_local ?? 0, inv.currency ?? 'NZD')}</td>
              <td className="portal-td--nums nums">{formatMoney(inv.balance ?? 0, inv.currency ?? 'NZD')}</td>
              <td><StatusPill status={invoiceStatus(inv)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
