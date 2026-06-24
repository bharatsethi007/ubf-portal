import { Link } from 'react-router-dom'
import type { Invoice } from '../types/invoice'
import { invoiceStatus } from '../types/invoice'
import { fmtMoney, fmtShort } from '../utils/format'

type Props = {
  invoices: Invoice[]
  loading?: boolean
  emptyMessage?: string
  showShipment?: boolean
  outstandingByCurrency?: Record<string, number>
}

export default function InvoicesTable({
  invoices,
  loading,
  emptyMessage = 'No invoices.',
  showShipment = false,
  outstandingByCurrency,
}: Props) {
  const outstanding = outstandingByCurrency
    ? Object.entries(outstandingByCurrency).filter(([, v]) => v > 0)
    : []

  return (
    <>
      {outstanding.length > 0 && (
        <div className="invoice-outstanding">
          {outstanding.map(([cur, amt]) => (
            <span key={cur} className="pill transit invoice-outstanding__badge">
              Outstanding: {fmtMoney(amt, cur === '—' ? null : cur)}
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <p className="muted pad-inline">Loading invoices…</p>
      ) : invoices.length === 0 ? (
        <p className="muted pad-inline">{emptyMessage}</p>
      ) : (
        <table className="data-table data-table--compact">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Type</th>
              {showShipment && <th>Shipment</th>}
              <th>Date</th>
              <th>Due</th>
              <th>Total</th>
              <th>Outstanding</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.invoice_no}>
                <td className="mono">{inv.invoice_no}</td>
                <td>{inv.doctype ?? '—'}</td>
                {showShipment && (
                  <td>
                    {inv.job_unique != null
                      ? <Link to={`/shipments/${inv.job_unique}`}>{inv.job_unique}</Link>
                      : '—'}
                  </td>
                )}
                <td className="mono">{fmtShort(inv.doc_date)}</td>
                <td className="mono">{fmtShort(inv.date_due)}</td>
                <td className="mono">{fmtMoney(inv.amt_local, inv.currency)}</td>
                <td className="mono">{fmtMoney(inv.balance, inv.currency)}</td>
                <td><InvoiceStatusPill status={invoiceStatus(inv)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

function InvoiceStatusPill({ status }: { status: ReturnType<typeof invoiceStatus> }) {
  const cls =
    status === 'Paid' ? 'pill arrived'
    : status === 'Part-paid' ? 'pill transit'
    : 'pill unpaid'
  return <span className={cls}>{status}</span>
}
